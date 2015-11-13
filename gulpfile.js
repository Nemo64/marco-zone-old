var gulp = require('gulp');
var del = require('del');
var browserSync = require('browser-sync').create();

var deployPath = '_site';
var sourceFiles = {
    scss: '_resources/*.scss',
    topicImages: ['_images/topics/*.png', '_images/topics/*.jpeg'],
    inlineImages: ['_images/inline/**/*.png', '_images/inline/**/*.jpeg']
};
var targetDirectories = {
    assets: deployPath + '/resources',
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
                quality: 0.85,
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

    [48, 96, 144, 192, 288, 432].forEach(function (size) {
        resizePipe(topicImages, size, {width: size});
    });

    [720, 1080, 1440, 1920, 2560].forEach(function (size) {
        resizePipe(topicImages, size, {width: size, height: size / 21 * 9, crop: true});
    });

    resizePipe(inlineImages, 'inline', {width: 690});

    return masterStream;
});

gulp.task('default', ['clean', 'html', 'css', 'images']);

gulp.task('watch', ['default'], function () {
    gulp.watch([
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
                    'X-Frame-Options': 'DENY',
                    'X-XSS-Protection': '1; mode=block'
                })
            ]
        }
    });
});