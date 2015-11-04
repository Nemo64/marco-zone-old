var gulp = require('gulp');
var del = require('del');
var browserSync = require('browser-sync').create();

var deployPath = 'web';
var sourceFiles = {
    scss: '_sources/*.scss',
    images: 'images/*',
    inlineImages: 'iamges/**/*'
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

    gulp.src([path.join(deployPath, '*.html'), path.join(deployPath, '**/*.html')])
        .pipe(htmlmin({
            removeComments: true,
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

    gulp.src(sourceFiles.scss)
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
        .pipe(browserSync.stream())
});

gulp.task('css', ['sass']);

gulp.task('images-thumbnail', function () {
    var imageResize = require('gulp-image-resize');
    var parallel = require('concurrent-transform');
    var os = require('os');
    var changed = require("gulp-changed");
    var rename = require("gulp-rename");

    return gulp.src(sourceFiles.images)
        .pipe(changed(targetDirectories.images))
        .pipe(parallel(imageResize({
            width: 128,
            height: 128,
            quality: 0.85,
            imageMagick: true
        }), os.cpus().length))
        .pipe(rename(function (path) {
            path.dirname += '/thumbnail'
        }))
        .pipe(gulp.dest(targetDirectories.images));
});

gulp.task('images-banner', function () {
    var imageResize = require('gulp-image-resize');
    var parallel = require('concurrent-transform');
    var os = require('os');
    var changed = require("gulp-changed");

    gulp.src(sourceFiles.images)
        .pipe(changed(targetDirectories.images))
        .pipe(parallel(imageResize({
            width: 512,
            height: 512,
            quality: 0.85,
            imageMagick: true
        }), os.cpus().length))
        .pipe(gulp.dest(targetDirectories.images));
});

gulp.task('images-inline', function () {
    var imageResize = require('gulp-image-resize');
    var parallel = require('concurrent-transform');
    var os = require('os');
    var changed = require("gulp-changed");

    gulp.src(sourceFiles.inlineImages)
        .pipe(changed(targetDirectories.images))
        .pipe(parallel(imageResize({
            width: 690,
            height: 690 / 4 * 3,
            quality: 0.85,
            imageMagick: true
        }), os.cpus().length))
        .pipe(gulp.dest(targetDirectories.images));
});

gulp.task('images', ['images-thumbnail', 'images-banner', 'images-inline']);

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
    browserSync.init({
        server: {
            baseDir: deployPath
        }
    });
});