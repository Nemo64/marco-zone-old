module.exports = function (document) {
    this.document = document;
};

module.exports.prototype = {
    isDisabled: function () {
        return this.document.cookie.indexOf('noga=1') >= 0;
    },

    disable: function () {
        var wasntSet = !this.isDisabled();
        this.document.cookie = 'noga=1; expires=Thu, 31 Dec 2099 23:59:59';
        alert("Google Analytics" + (wasntSet ? " " : " war bereits ") + "deaktiviert");
    },

    init: function () {
        window.noga = this.disable.bind(this);
        if (this.isDisabled()) {
            return;
        }

        /* jshint ignore:start */
        (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
            (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
            m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
        })(window,this.document,'script','//www.google-analytics.com/analytics.js','ga');
        /* jshint ignore:end */

        ga('create', 'UA-60388424-1', 'auto');
        ga('set', 'anonymizeIp', true);

        // use the canonical url for page tracking if possible
        var canonical = this.document.querySelector('link[rel="canonical"]');
        var pathname = canonical && canonical.href || location.pathname;
        ga('send', 'pageview', pathname.replace(/^https?\:\/\/[^\/]+\/?/i, '/'));

        this._trackClipboard();
        this._trackClicks();

    },

    _trackClipboard: function () {
        var track = function (e) {
            var node = e.target;
            while (!/code/i.test(node.nodeName)) {
                // iterate until there is no parent
                if (!(node = node.parentNode)) {
                    return;
                }
            }

            ga('send', 'event', 'Code', 'copy', node.getAttribute('data-lang'));
        };
        ['copy', 'cut'].forEach(function (event) {
            this.document.addEventListener(event, track, true);
        }, this);
    },

    _trackClicks: function () {
        var self = this;
        this.document.addEventListener('click', function (e) {
            if (e.defaultPrevented) {
                return;
            }

            var link = e.target;
            while (!/a/i.test(link.nodeName)) {
                // iterate until there is no parent
                if (!(link = link.parentNode)) {
                    return;
                }
            }

            if (link.clickTracked) {
                return;
            }

            var category = self._detectCategory(link);
            var action = self._detectAction(link);
            var label = self._detectLabel(link);

            var valid = category && action && label;
            if (!valid) {
                return;
            }

            e.preventDefault();

            // functions for actual click
            var hitCallbackExecuted = false;
            var hitCallback = function () {
                if (hitCallbackExecuted) {
                    return;
                }

                link.clickTracked = true;
                link.click();
                hitCallbackExecuted = true;
            };

            ga('send', 'event', category, action, label, {hitCallback: hitCallback});
            setTimeout(hitCallback, 500);

            // start prefetch of links
            if (link.host) {
                self._prefetchLink(link.href);
            }

        }, false);
    },

    _prefetchLink: function (href) {
        // prerender is most useful but has least browser support
        // prefetch is still useful and widely supported
        ['prerender', 'prefetch'].forEach(function (rel) {
            var hint = this.document.createElement('link');
            hint.rel = rel;
            hint.href = href;
            this.document.head.appendChild(hint);
        }, this);
    },

    _detectCategory: function (link) {
        var dataCategory = link.getAttribute('data-ga-category');
        if (dataCategory) {
            return dataCategory;
        }

        return 'link';
    },

    _detectAction: function (link) {
        var dataAction = link.getAttribute('data-ga-action');
        if (dataAction) {
            return dataAction;
        }

        // javascript links aren't really links
        if (/^javascript\:/i.test(link.href)) {
            return null;
        }

        // every link that does have a file extension other than html or none is considered a download
        if (!/\/([^\.]*|.*\.(html|[^\.]{5,}))(\?.*)?$/i.test(link.href)) {
            return 'download';
        }

        // internal links (other than downloads) are not interesting
        if (link.host === location.host) {
            return null;
        }

        if (/^mailto\:/i.test(link.href)) {
            return 'mail';
        }

        if (/^tel:/i.test(link.href)) {
            return 'call';
        }

        if (link.host && link.host !== location.host) {
            return 'external';
        }

        return 'click';
    },

    _detectLabel: function (link) {
        var dataLabel = link.getAttribute('data-ga-label');
        if (dataLabel) {
            return dataLabel;
        }

        if (/^(tel|mailto)\:/i.test(link.href)) {
            return href.replace(/^(mailto|tel)\:\s*/, '');
        }

        // if everything fails use href
        return link.href;
    }
};