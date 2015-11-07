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
    var parallel = require('concurrent-transform');
    var os = require('os');
    var changed = require("gulp-changed");
    var merge = require('merge');

    var highQuality = 0.8;
    var lowQuality = 0.5;
    var masterStream = require('merge-stream')();

    var resizePipe = function (images, variant, options) {
        var stream = images
            .pipe(changed(targetDirectories.images + '/' + variant, {extension: '.jpeg'}))
            .pipe(imageResize(merge({
                quality: highQuality,
                format: 'jpeg',
                imageMagick: true
            }, options)))
            .pipe(gulp.dest(targetDirectories.images + '/' + variant))
            .pipe(browserSync.stream());

        masterStream.add(stream);
    };

    var inlineImages = gulp.src(sourceFiles.inlineImages);
    var topicImages = gulp.src(sourceFiles.topicImages);
    topicImages.setMaxListeners(100);

    resizePipe(inlineImages, 'inline/sm-1x', {width: 480 - 30});
    resizePipe(inlineImages, 'inline/xl-1x', {width: 720 - 30});

    var sizeOptions = [
        {name: '1x', quality: highQuality, sizeFactor: 1},
        {name: '2x', quality: lowQuality, sizeFactor: 2}
    ];
    sizeOptions.forEach(function (o) {
        var baseOptions = {quality: o.quality, upscale: true};
        var wf = o.sizeFactor;
        var hf = o.sizeFactor * 9 / 21;

        resizePipe(topicImages, 'thumbnail/sm-' + o.name, merge(baseOptions, {width: 54 * wf}));
        resizePipe(topicImages, 'thumbnail/xl-' + o.name, merge(baseOptions, {width: 128 * wf}));

        resizePipe(topicImages, 'banner/sm-' + o.name, merge(baseOptions, {width: 480 * wf, height: 480 * hf, crop: true}));
        resizePipe(topicImages, 'banner/md-' + o.name, merge(baseOptions, {width: 720 * wf, height: 720 * hf, crop: true}));
        resizePipe(topicImages, 'banner/lg-' + o.name, merge(baseOptions, {width: 960 * wf, height: 960 * hf, crop: true}));
        resizePipe(topicImages, 'banner/xl-' + o.name, merge(baseOptions, {width: 1156 * wf, height: 1156 * hf, crop: true}));
    });

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