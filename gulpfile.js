var gulp = require('gulp');
var browserSync = require('browser-sync').create();
var argv = require('yargs').argv;

var deployPath = '_site';
var sourceFiles = {
    scss: '_resources/*.scss',
    topicImages: '_images/topics/*.{png,jpg,jpeg,gif}',
    inlineImages: '_images/inline/**/*.{png,jpg,jpeg,gif}'
};
var targetDirectories = {
    assets: deployPath + '/resources',
    images: deployPath + '/images'
};

var build = {
    production: argv.production == true,
    incremental: argv.complete != true && argv.production != true,
    verbose: argv.verbose == true
};

gulp.task('build', ['html', 'css', 'images']);

gulp.task('serve', ['build', 'watch'], function () {
    var modRewrite = require('connect-modrewrite');
    var header = require('connect-header');

    browserSync.init({
        open: false,
        https: true,
        snippetOptions: {
            rule: build.production ? { match: /qqqqqqqqq/ } : {}
        },
        server: {
            baseDir: deployPath,
            middleware: [
                modRewrite([
                    // rewrite eg. "index" to "index.html"
                    '^(.*)/([^\.\/]+)$ $1/$2.html'
                ]),
                header({
                    // these should be the same in the _headers file
                    'X-UA-Compatible': 'IE=Edge',
                    'X-XSS-Protection': '1; mode=block'
                })
            ]
        }
    });
});

gulp.task('watch', function () {
    var watchFiles = {
        html: [
            '_includes/*.html',
            '_includes/**/*.html',
            '_layouts/*.html',
            '_layouts/**/*.html',
            '_data/*',
            '_data/**/*',
            '_posts/*',
            '_posts/**/*',
            'pages/*',
            'pages/**/*',
            'meta_files/*'
        ],
        css: [
            '_resources/*.scss',
            '_resources/**/*.scss'
        ]
    };
    //if (build.production) {
        gulp.watch(watchFiles.html.concat(watchFiles.css), ['html']);
    //} else {
    //    gulp.watch(watchFiles.html, ['html']);
    //    gulp.watch(watchFiles.css, ['css']);
    //}
});

gulp.task('jekyll', function (gulpCallBack) {
    var spawn = require('win-spawn');
    var jekyll = spawn('jekyll', [
        'build',
        '--no-watch',
        build.verbose ? undefined : '--quiet',
        '--future',
        //'--incremental',
        '--destination', deployPath
    ], {stdio: 'inherit'});

    jekyll.on('exit', function (code) {
        gulpCallBack(code === 0 ? null : 'ERROR: Jekyll process exited with code: ' + code);
    });
});

gulp.task('html', build.production ? ['jekyll', 'css'] : ['jekyll'], function () {
    var htmlmin = require('gulp-htmlmin');

    return gulp.src([deployPath + '/*.html', deployPath + '/**/*.html'])
        .pipe(htmlmin({
            removeComments: true,
            collapseWhitespace: true,
            collapseBooleanAttributes: true,
            removeAttributeQuotes: false,
            removeRedundantAttributes: true,
            removeEmptyAttributes: true,
            removeOptionalTags: false,
            minifyJS: true,
            minifyCSS: {
                advanced: true,
                keepSpecialComments: 0,
                processImport: true, //build.production,
                root: deployPath
            }
        }))
        .pipe(gulp.dest(deployPath))
        .pipe(browserSync.stream());
});

gulp.task('sass', function () {
    var sass = require('gulp-sass');
    var autoprefixer = require('gulp-autoprefixer');
    var replace = require('gulp-replace');

    var removeRules = [
        '@[\\w-]*viewport', // is currently still invalid
        'button|input|optgroup|select|textarea|label|caption|fieldset|legend', // form elements
        'address|hr|dfn|h4|h5|h6|abbr|mark|sub|sup|aside|details|hgroup|summary', // content description
        'audio|canvas|progress|video|template|svg', // function
        'kbd|samp|output', // code
        'table|tbody|thead|tfoot|tr|td|th', // table
        'dl|dt|dd', // definition list
        '\\.navbar-(?:fixed-\\w+|sticky-\\w+|divider|light|toggl[\\w-]+)', // navbar
        '\\.nav-tabs|\\.tab-content' // tabs
    ];
    var selectorRegEx = new RegExp('\\s*,?[^{},]*(?:' + removeRules.join('|') + ')(?![\\w-])[^{},]*', 'g');

    return gulp.src(sourceFiles.scss)
        .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
        .pipe(replace(/([^{}]+)(\{[^{}]*})/g, function (match, selector, blockContent) {
            var filteredSelector = selector.replace(selectorRegEx, '');
            return (filteredSelector.length > 0) ? (filteredSelector + blockContent) : '';
        }))
        .pipe(replace(/\s*!important\s*/ig, '')) // !important is prohibited by amp
        .pipe(autoprefixer({browsers: [
            '> 0.2% in DE',
            'last 2 versions',
            'Firefox ESR',
            'not IE <= 8'
        ]}))
        .pipe(gulp.dest(targetDirectories.assets))
        .pipe(browserSync.stream());
});

gulp.task('css', ['sass']);

gulp.task('images', function () {
    var gm = require('gulp-gm');
    var masterStream = require('merge-stream')();

    function processImages(src, variant, callback) {
        var stream = gulp.src(src)
            .pipe(gm(callback))
            .pipe(gulp.dest(targetDirectories.images + '/' + variant));
        masterStream.add(stream);
    }

    function asIs(gmfile) {
        return gmfile.strip();
    }

    function asJpeg(quality, gmfile) {
        return gmfile.strip().background('#6B0000').flatten().setFormat('jpeg').quality(quality);
    }

    [96, 192].forEach(function (size) {
        processImages(sourceFiles.topicImages, size, function (gmfile) {
            var q = size > 128 ? 65 : 90;
            return asJpeg(q, gmfile.filter('Catrom').resize(size, size, '^').gravity('Center').crop(size, size));
        });
    });

    [1].forEach(function (factor) {
        // the aspect ratio is taken from https://developers.facebook.com/docs/sharing/best-practices#images
        var width = 1200 * factor;
        var height = 630 * factor;
        processImages(sourceFiles.topicImages, width, function (gmfile) {
            return asJpeg(90, gmfile.filter('Catrom').resize(width, height, '^').gravity('Center').crop(width, height));
        });
    });

    processImages(sourceFiles.inlineImages, 'inline', function (gmfile) {
        return asIs(gmfile.resize(690, null, '>'));
    });

    return masterStream;
});