/*   __________  ___  ____
    /_  __/ __ \/ _ \/ __ \
     / / / /_/ / // / /_/ /
    /_/  \____/____/\____/

    - Add cookie tracking across multiple tabs.
    - Change key/mouse session reset to only reset during a certain interval, to avoid spamming the reset method.
    - Write WIKI
    - Push to plugins.jquery.com
 */

/*!     ____            _           ___  _      __
       / __/__ ___ ___ (_)__  ___  / _ \(_)__ _/ /__  ___ _
      _\ \/ -_|_-<(_-</ / _ \/ _ \/ // / / _ `/ / _ \/ _ `/
     /___/\__/___/___/_/\___/_//_/____/_/\_,_/_/\___/\_, /
                                                    /___/
    v1.1 - http://portablesheep.github.com/SessionDialog
    jQuery UI widget for showing user session expiration warning and count down before logout.
    Copyright 2012, Michael Gunderson - Dual licensed under the MIT or GPL Version 2 licenses. Same as jQuery.
 */
(function($) {
    $.widget('ui.sessiondialog', $.ui.dialog, {
        options: {
            url: null, //The url to redirect to on timeout.
            timeoutInterval: 1800000, //Time in MS to wait until the dialog is shown.
            countDownTimeout: 20, //How many seconds to countdown.
            countDownElement: null, //The element where the countdown text will be rendered.
            resetOnActivity: false, //Reset on mouse/keyboard activity?
            multiTabSync: true, //Use a cookie to track activity on other tabs, to avoid timing out on one while active in another in the same session.
            syncCookie: {
                expires: null,
                path: null,
                domain: null,
                secure: false
            }
        },
        _mainTimeout: null, _countDownInterval: null, _syncInterval: null,
        _$document: $(document), _eventNamespace: '.sessUsrEvents' + Math.floor(Math.random() * 100),
        /*    _____          __    _       __  ___    __  __           __
             / ___/__  ___  / /__ (_)__   /  |/  /__ / /_/ /  ___  ___/ /__
            / /__/ _ \/ _ \/  '_// / -_) / /|_/ / -_) __/ _ \/ _ \/ _  (_-<
            \___/\___/\___/_/\_\/_/\__/ /_/  /_/\__/\__/_//_/\___/\_,_/___/
        */
        _cookie: function(n, v) {
            if (v !== undefined) {
                var settings = this.options.syncCookie;
                if (settings.expires && typeof(settings.expires) === 'number') {
                    var exp = settings.expires;
                    settings.expires = new Date();
                    settings.expires.setDate(settings.expires.getDate() + exp);
                }
                v = ($.isPlainObject(v) ? JSON.stringify(v) : v);
                document.cookie = [
                    n + '=' + encodeURIComponent(v),
                    settings.expires ? ';expires=' + settings.expires.toUTCString() : '',
                    settings.path ? '; path=' + settings.path : '',
                    settings.domain ? '; domain=' + settings.domain : '',
                    settings.secure ? '; secure' : ''
                ].join('');
            } else {
                var cookies = document.cookie.split(';');
                for(var i = 0; i < cookies.length; i++) {
                    var key = cookies[i].substr(0, cookies[i].indexOf('=')).replace(/\+/g, ''),
                        val = decodeURIComponent(cookies[i].substr(cookies[i].indexOf('=') + 1));
                    if (key == n) {
                        try {
                            if (val[0] === '{' && val[val.length-1] === '}') {
                                return $.parseJSON(val);
                            } else {
                                return val;
                            }
                        } catch(e){}
                    }
                }
            }
        },
        /*   ______             __    _             ____              __    __ __             ____
            /_  __/______ _____/ /__ (_)__  ___ _  / __/  _____ ___  / /_  / // /__ ____  ___/ / /__ _______
             / / / __/ _ `/ __/  '_// / _ \/ _ `/ / _/| |/ / -_) _ \/ __/ / _  / _ `/ _ \/ _  / / -_) __(_-<
            /_/ /_/  \_,_/\__/_/\_\/_/_//_/\_, / /___/|___/\__/_//_/\__/ /_//_/\_,_/_//_/\_,_/_/\__/_/ /___/
                                          /___/
        */
        _trackClickHandler: function() {
        },
        _keyUpHandler: function() {
        },
        /*     __  ___    __  __           __
              /  |/  /__ / /_/ /  ___  ___/ /__
             / /|_/ / -_) __/ _ \/ _ \/ _  (_-<
            /_/  /_/\__/\__/_//_/\___/\_,_/___/
        */
       _expireAndRedirect: function() {
            if (this.options.multiTabSync && this._syncInterval) {
                clearInterval(this._syncInterval);
            }
            this._cookie('multiTabSync', { expired: true });
            this._clearTimers();
            if (this.options.url) {
                window.location.replace(this.options.url);
            }
       },
        // _hideTimeout: function() {
        //     this._trigger('hideTimeoutWarning', this);
        //     this.close();
        // },
        // _setTrackingEvents: function() {
        //     if (this.options.resetOnActivity) {
        //         var self = this;
        //         this._$document.on('click' + this._eventNamespace, function() {
        //             self._resetSession.call(self, true);
        //         }).on('keyup' + this._eventNamespace, function() {
        //             self._resetSession.call(self, true);
        //         });
        //     }
        // },
        // _stopTrackingEvents: function() {
        //     if (this.options.resetOnActivity) {
        //         this._$document.off(this._eventNamespace);
        //     }
        // },
        _clearTimers: function() {
            if (this._countDownInterval) {
                clearInterval(this._countDownInterval);
            }
            if (this._mainTimeout) {
                clearTimeout(this._mainTimeout);
            }
        },
        _extendSession: function() {
            this._trigger('extendSession', this);
            this._resetSession();
        },
        _resetSession: function(fromTracking) {
            this._clearTimers();
            this._mainTimeout = setTimeout($.proxy(function() {
                this._showWarning.call(this);
            }, this), this.options.timeoutInterval);
            // if (!fromTracking) {
            //     this._hideTimeout();
            //     this._stopTrackingEvents();
            //     this._setTrackingEvents();
            // }
        },
        _startSync: function() {
            var cookie = this._cookie('multiTabSync');
            if (!cookie || !$.isPlainObject(cookie)) {
                cookie = {
                    expired: false
                };
            }
            this._cookie('multiTabSync', cookie);
            this._syncInterval = setInterval($.proxy(function() {
                var tmp = this._cookie('multiTabSync');
                if (tmp.expired) {
                    this._expireAndRedirect();
                }
                // console.log(this._cookie('multiTabSync'));
            }, this), 1000);
        },
        /*   _      __              _
            | | /| / /__ ________  (_)__  ___ _
            | |/ |/ / _ `/ __/ _ \/ / _ \/ _ `/
            |__/|__/\_,_/_/ /_//_/_/_//_/\_, /
                                        /___/
        */
        _showWarning: function() {
            // this._stopTrackingEvents();
            var tick = this.options.countDownTimeout;
            if (this.options.countDownElement) {
                this.options.countDownElement.text(tick);
            }
            this._trigger('showTimeoutWarning', this);
            this.open();
            this._countDownInterval = setInterval($.proxy(function() {
                if (tick <= 0) {
                    clearInterval(this._countDownInterval);
                    this._trigger('sessionTimeout', this);
                    this.close();
                    this._expireAndRedirect();
                    this._resetSession();
                }
                tick--;
                if (this.options.countDownElement) {
                    this.options.countDownElement.text(tick);
                }
            }, this), 1000);
        },
        /*     ____     _ __
              /  _/__  (_) /_
             _/ // _ \/ / __/
            /___/_//_/_/\__/
        */
        _create: function() {
            var self = this, extendButton = null;
            if (this.options.buttons) {
                for(var i in this.options.buttons) {
                    if (this.options.buttons[i].hasOwnProperty('extendTime') && this.options.buttons[i].extendTime) {
                        extendButton = this.options.buttons[i];
                        break;
                    }
                }
                if (extendButton) {
                    if (extendButton.hasOwnProperty('click')) {
                        extendButton.click = $.proxy(function(handler) {
                            this._extendSession();
                            handler.call(this.element[0]);
                        }, this, extendButton.click);
                    }
                } else {
                    throw 'No button found with the extendTime option.';
                }
            }
            $.ui.dialog.prototype._create.call(this, this.options);
            this.element.parents('div.ui-dialog').find('div.ui-dialog-titlebar .ui-dialog-titlebar-close').hide();
            if (this.options.multiTabSync) {
                this._startSync();
            }
            this._resetSession();
            return this;
        }
    });
})(jQuery);