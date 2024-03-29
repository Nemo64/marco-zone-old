var gulp = require('gulp');
var browserSync = require('browser-sync').create();
var argv = require('yargs').argv;

var deployPath = '_site';
var sourceFiles = {
    scss: '_resources/*.scss',
    javascript: '_resources/*.js',
    allJavascript: ['_resources/*.js', '_resources/javascript/*.js', '_resources/javascript/**/*.js'],
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

gulp.task('build', ['html', 'css', 'images', 'js']);

gulp.task('serve', ['build', 'watch'], function () {
    var modRewrite = require('connect-modrewrite');
    var header = require('connect-header');

    browserSync.init({
        open: false,
        https: true,
        snippetOptions: {
            rule: build.production ? {match: /qqqqqqqqq/} : {}
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
            '_drafts/*',
            '_drafts/**/*',
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
        build.production ? undefined : '--future',
        build.production ? undefined : '--drafts',
        build.production ? undefined : '--limit_posts',
        build.production ? undefined : '10',
        //'--incremental',
        '--destination', deployPath
    ], {stdio: 'inherit'});

    jekyll.on('exit', function (code) {
        gulpCallBack(code === 0 ? null : 'ERROR: Jekyll process exited with code: ' + code);
    });
});

gulp.task('html', ['jekyll', 'css'], function () {
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
        'audio|canvas|progress|video|template|svg|small|\\[hidden\\]', // function
        'kbd|samp|output', // code
        'map|area', // map
        'table|tbody|thead|tfoot|tr|td|th', // table
        'dl|dt|dd', // definition list
        '\\.navbar-(?:fixed-\\w+|sticky-\\w+|divider|light|toggl[\\w-]+|full)|.navbar-brand\\W+img', // navbar
        '\\.nav-(tabs|pills|stacked|inline)|\\.tab-content', // navs/tabs
        '\\.nav-(link|item)' // nav link and item (not used yet)
    ];
    var selectorRegEx = new RegExp('\\s*,?[^{},]*(?:' + removeRules.join('|') + ')(?![\\w-])[^{},]*', 'g');

    return gulp.src(sourceFiles.scss)
        .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
        .pipe(replace(/([^{}]+)(\{[^{}]*})/g, function (match, selector, blockContent) {
            var filteredSelector = selector.replace(selectorRegEx, '');
            return (filteredSelector.length > 0) ? (filteredSelector + blockContent) : '';
        }))
        .pipe(replace(/filter:[^;}]+;?/ig, '')) // remove ms filter since i don't need to fully support ie9
        .pipe(replace(/\s*!important\s*/ig, '')) // !important is prohibited by amp
        .pipe(autoprefixer({
            browsers: [
                '> 0.2% in DE',
                'last 2 versions',
                'Firefox ESR',
                'not IE <= 8'
            ]
        }))
        .pipe(gulp.dest(targetDirectories.assets))
        .pipe(browserSync.stream());
});

gulp.task('css', ['sass']);

gulp.task('jshint', function () {
    var jshint = require('gulp-jshint');

    return gulp.src(sourceFiles.allJavascript)
        .pipe(jshint())
        .pipe(jshint.reporter('default', {verbose: true}))
});

gulp.task('js', ['jshint'], function () {
    //var sourcemaps = require('gulp-sourcemaps');
    var browserify = require('gulp-browserify');
    var uglify = require('gulp-uglify');

    return gulp.src(sourceFiles.javascript)
        .pipe(browserify({debug: true}))
        //.pipe(sourcemaps.init({loadMaps: true}))
        .pipe(uglify({compress: {unsafe: true}}))
        //.pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(targetDirectories.assets));
});

gulp.task('images', function () {
    var gm = require('gulp-gm');
    var masterStream = require('merge-stream')();

    function processImages(src, variant, callback) {
        var stream = gulp.src(src)
            .pipe(gm(callback, {imageMagick: true}))
            .pipe(gulp.dest(targetDirectories.images + '/' + variant));
        masterStream.add(stream);
    }

    [96, 192].forEach(function (size) {
        processImages(sourceFiles.topicImages, size, function (gmfile) {
            var quality = size > 128 ? 65 : 90;
            return gmfile
                .background('#6B0000').flatten()
                .filter('Catrom').resize(size, size, '^')
                .gravity('Center').crop(size, size, 0, 0)
                .strip().setFormat('jpeg').quality(quality);
        });
    });

    [1].forEach(function (factor) {
        // the aspect ratio is taken from https://developers.facebook.com/docs/sharing/best-practices#images
        var width = 1200 * factor;
        var height = 630 * factor;
        processImages(sourceFiles.topicImages, width, function (gmfile) {
            return gmfile
                .background('#6B0000').flatten()
                .filter('Catrom').resize(width, height, '^')
                .gravity('Center').crop(width, height)
                .strip().setFormat('jpeg').quality(90);
        });
    });

    processImages(sourceFiles.inlineImages, 'inline', function (gmfile) {
        return gmfile
            .resize(690, null, '>')
            .strip();
    });

    return masterStream;
});