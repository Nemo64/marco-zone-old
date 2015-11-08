var gulp = require('gulp');
var del = require('del');
var browserSync = require('browser-sync').create();

var deployPath = 'web';
var sourceFiles = {
    scss: '_sources/*.scss',
    topicImages: ['images/topics/*.png', 'images/topics/*.jpeg'],
    inlineImages: ['images/inline/**/*.png', 'images/inline/**/*.jpeg']
};
var targetDirectories = {
    assets: deployPath + '/assets',
    images: deployPath + '/images'
};

gulp.task('clean', function () {
    del([targetDirectories.assets])
});

gulp.task('jekyll', function (gulpCallBack) {
    var spawn = require('child_process').spawn;
    var jekyll = spawn('jekyll', [
        'build',
        '--no-watch',
        '--quiet',
        '--future',
        //'--incremental',
        '--destination', deployPath
    ], {stdio: 'inherit'});

    jekyll.on('exit', function (code) {
        gulpCallBack(code === 0 ? null : 'ERROR: Jekyll process exited with code: ' + code);
    });
});

gulp.task('html', ['jekyll'], function () {
    var htmlmin = require('gulp-htmlmin');
    var path = require('path');

    return gulp.src([path.join(deployPath, '*.html'), path.join(deployPath, '**/*.html')])
        .pipe(htmlmin({
            removeComments: false,
            collapseWhitespace: true,
            collapseBooleanAttributes: true,
            removeAttributeQuotes: false,
            removeRedundantAttributes: true,
            removeEmptyAttributes: true,
            removeOptionalTags: false,
            minifyJS: true
        }))
        .pipe(gulp.dest(deployPath))
        .pipe(browserSync.stream());
});

gulp.task('sass', function () {
    var sass = require('gulp-sass');
    var autoprefixer = require('gulp-autoprefixer');
    var sourcemaps = require('gulp-sourcemaps');

    return gulp.src(sourceFiles.scss)
        .pipe(sourcemaps.init())
        .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
        .pipe(autoprefixer({browsers: [
            '> 0.2% in DE',
            'last 2 versions',
            'Firefox ESR',
            'not IE <= 8'
        ]}))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(targetDirectories.assets))
        .pipe(browserSync.stream());
});

gulp.task('css', ['sass']);

gulp.task('images', function () {
    var imageResize = require('gulp-image-resize');
    var changed = require("gulp-changed");
    var merge = require('merge');

    var masterStream = require('merge-stream')();

    var resizePipe = function (images, variant, options) {
        var stream = images
            .pipe(changed(targetDirectories.images + '/' + variant, {extension: '.jpeg'}))
            .pipe(imageResize(merge({
                quality: 0.9,
                format: 'jpeg',
                filter: 'Catrom',
                imageMagick: true
            }, options)))
            .pipe(gulp.dest(targetDirectories.images + '/' + variant))
            .pipe(browserSync.stream());

        masterStream.add(stream);
    };

    var inlineImages = gulp.src(sourceFiles.inlineImages);
    var topicImages = gulp.src(sourceFiles.topicImages);
    topicImages.setMaxListeners(100);

    var sizeOptions = [
        {name: '1x', thumbQuality: 0.9, bannerQuality: 0.85, sizeFactor: 1},
        {name: '2x', thumbQuality: 0.7, bannerQuality: 0.6, sizeFactor: 2}
    ];
    sizeOptions.forEach(function (def) {
        var baseOptions = {upscale: true};
        var wf = def.sizeFactor;
        var hf = def.sizeFactor * 9 / 21;

        var thumbOptions = merge(baseOptions, {quality: def.thumbQuality});
        resizePipe(topicImages, 'thumbnail/sm-' + def.name, merge(thumbOptions, {width: 54 * wf}));
        resizePipe(topicImages, 'thumbnail/xl-' + def.name, merge(thumbOptions, {width: 128 * wf}));

        var bannerOptions = merge(baseOptions, {quality: def.bannerQuality, crop: true});
        var sm = 34 * 16, md = 48 * 16, lg = 62 * 16, xl = 75 * 16, max = 1600;
        resizePipe(topicImages, 'banner/xs-' + def.name, merge(bannerOptions, {width: sm * wf, height: sm * hf}));
        resizePipe(topicImages, 'banner/sm-' + def.name, merge(bannerOptions, {width: md * wf, height: md * hf}));
        resizePipe(topicImages, 'banner/md-' + def.name, merge(bannerOptions, {width: lg * wf, height: lg * hf}));
        resizePipe(topicImages, 'banner/lg-' + def.name, merge(bannerOptions, {width: xl * wf, height: xl * hf}));
        resizePipe(topicImages, 'banner/xl-' + def.name, merge(bannerOptions, {width: max * wf, height: max * hf}));
    });

    resizePipe(inlineImages, 'inline/sm-1x', {width: 480 - 30});
    resizePipe(inlineImages, 'inline/xl-1x', {width: 720 - 30});

    return masterStream;
});

gulp.task('default', ['clean', 'html', 'css', 'images']);

gulp.task('watch', ['default'], function () {
    gulp.watch([
        '*.html',
        '_*/*.html',
        'pages/*.*',
        '*/*.markdown'
    ], ['html']);
    gulp.watch([
        '_sources/*.scss',
        '_sources/**/*.scss'
    ], ['css']);
    gulp.watch([
        'images/*',
        'images/**/*'
    ], ['images']);
});

gulp.task('serve', ['watch'], function () {
    var modRewrite = require('connect-modrewrite');
    var header = require('connect-header');

    browserSync.init({
        open: false,
        server: {
            baseDir: deployPath,
            middleware: [
                modRewrite([
                    // rewrite eg. "index" to "index.html"
                    '^(.*)/([^\.\/]+)$ $1/$2.html'
                ]),
                header({
                    // these should be the same in the _headers file
                    'X-Frame-Options': 'DENY'
                })
            ]
        }
    });
});