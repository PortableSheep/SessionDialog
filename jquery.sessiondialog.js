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
    v1.1.0 - http://portablesheep.github.com/SessionDialog
    jQuery UI widget for showing user session expiration warning and count down before logout.
    Copyright 2012, Michael Gunderson - Dual licensed under the MIT or GPL Version 2 licenses. Same as jQuery.
 */
(function($) {
    $.widget('ui.sessiondialog', $.ui.dialog, {
        options: {
            url: null, //The url to redirect to on timeout.
            countDownTimeout: 20, //How many seconds to countdown.
            countDownElement: null, //The element where the countdown text will be rendered.
            resetOnActivity: false, //Reset on mouse/keyboard activity?
            multiTabSync: true, //Use a cookie to track activity on other tabs, to avoid timing out on one while active in another in the same session.
            syncCookie: {
                expires: null,
                path: null,
                domain: null,
                secure: false
            },
            timeoutSeconds: 30, //The number of seconds before the timeout warning should be showing to an inactive user.
            activityTimeout: 15 //The number of seconds between detected activity before the user is considered inactive.
        },
        _countDownInterval: null, _tickInterval: null, _tick: 0,
        _isShowing: false, _isIdle: false, _lastActivity: null,
        _$document: $(document), _eventNamespace: '.sessUsrEvents' + Math.floor(Math.random() * 100),
        /*    _____          __    _       __             _
             / ___/__  ___  / /__ (_)__   / /  ___  ___ _(_)___
            / /__/ _ \/ _ \/  '_// / -_) / /__/ _ \/ _ `/ / __/
            \___/\___/\___/_/\_\/_/\__/ /____/\___/\_, /_/\__/
                                                  /___/
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
        /*   ______             __    _               __  _______     __     __ __             ____
            /_  __/______ _____/ /__ (_)__  ___ _   _/_/ /_  __(_)___/ /__  / // /__ ____  ___/ / /__ _______
             / / / __/ _ `/ __/  '_// / _ \/ _ `/ _/_/    / / / / __/  '_/ / _  / _ `/ _ \/ _  / / -_) __(_-<
            /_/ /_/  \_,_/\__/_/\_\/_/_//_/\_, / /_/     /_/ /_/\__/_/\_\ /_//_/\_,_/_//_/\_,_/_/\__/_/ /___/
                                          /___/
        */
        _trackActivityHandler: function() {
            this._lastActivity = new Date().getTime();
        },
        _tickHandler: function() {
            //Set _isIdle, depending on the amount of seconds since their last click/keyup.
            this._isIdle = Math.round((new Date().getTime() - this._lastActivity) / 1000) >= this.options.activityTimeout;

            var cookie = this.options.multiTabSync ? this._cookie('multiTabSync') : {};
            if (!this._isIdle && cookie.showing && !this._isShowing) {
                //We're not idle, but some other tab is showing... extend the session to avoid this.
                this._extendSession(true);
                return;
            }

            // var otherTabShowing = false, syncCookie = {};
            // if (this.options.multiTabSync) {
            //     syncCookie = this._cookie('multiTabSync');
            //     if (syncCookie.expired) {
            //         this._expireAndRedirect();
            //         return;
            //     } else if (syncCookie.extended) {
            //         this._extendSession(true);
            //         return;
            //     } else {
            //         otherTabShowing = syncCookie.showing;
            //     }
            // }

            //If the current tick + 1 is more than or equal to the timeout we're after...
            if (this._tick + 1 >= this.options.timeoutSeconds) {
                //If the user has not been idle long enough, and we're resetting on activity... then extend the session. Otherwise, show the warning.
                if (!this._isIdle && this.options.resetOnActivity) {
                    this._extendSession(true);
                } else if (!this._isShowing) {
                    this._isShowing = true;
                    if (this.options.multiTabSync) {
                        cookie.showing = true;
                        this._cookie('multiTabSync', cookie);
                    }
                    this._stopTracking();
                    this._showCountDown();
                }
            } else {
                this._tick++;
            }
        },
        /*     __  ___    __  __           __
              /  |/  /__ / /_/ /  ___  ___/ /__
             / /|_/ / -_) __/ _ \/ _ \/ _  (_-<
            /_/  /_/\__/\__/_//_/\___/\_,_/___/
        */
        _extendSession: function(fromTick) {
            this._clearTimers();
            this._isShowing = false;
            if (this.options.multiTabSync) {
                this._cookie('multiTabSync', $.extend({ showing: false }, this._cookie('multiTabSync')));
            }
            if (!fromTick) {
                this._startTracking();
            }
            this._startTick();
            this._trigger('extendSession', this);
        },
        // _resetCookie: function() {
            // var temp = {
                // expired: false,
                // showing: false,
                // extended: extend||false
            // };
            // this._cookie('multiTabSync', temp);
            // if (extend) {
            //     setTimeout($.proxy(function(obj) {
            //         obj.extended = false;
            //         this._cookie('multiTabSync', obj);
            //     }, this, temp), 1000);
            // }
        // },
        _expireAndRedirect: function() {
            if (this.options.multiTabSync) {
                this._cookie('multiTabSync', { expired: true });
            }
            this._clearTimers();
            this._stopTracking();
            console.log('REDIRECT');
            if (this.options.url) {
                // window.location.replace(this.options.url);
            }
        },
        _startTracking: function() {
            this._$document.on('click' + this._eventNamespace, $.proxy(this._trackActivityHandler, this)).on('keyup' + this._eventNamespace, $.proxy(this._trackActivityHandler, this));
            this._trackActivityHandler();
        },
        _stopTracking: function() {
            this._$document.off(this._eventNamespace);
        },
        _clearTimers: function() {
            if (this._countDownInterval) {
                clearInterval(this._countDownInterval);
            }
            if (this._tickInterval) {
                clearInterval(this._tickInterval);
            }
        },
        // _resetSession: function(extend) {
            // this._resetCookie(extend);
            // this._clearTimers();
            // this._mainTimeout = setTimeout($.proxy(function() {
            //     this._showWarning.call(this);
            // }, this), this.options.timeoutInterval);
            // if (!fromTracking) {
            //     this._hideTimeout();
            //     this._stopTrackingEvents();
            //     this._setTrackingEvents();
            // }
        // },
        // _startSync: function() {
            // this._resetCookie();
            // this._syncInterval = setInterval($.proxy(function() {
            //     var tmp = this._cookie('multiTabSync');
            //     if (tmp.expired) {
            //         this._expireAndRedirect();
            //     } else if (tmp.extended) {
            //     }
            // }, this), 1000);
        // },
        _startTick: function() {
            this._tick = 0;
            this._clearTimers();
            this._tickInterval = setInterval($.proxy(this._tickHandler, this), 1000);
        },
        /*   _      __              _
            | | /| / /__ ________  (_)__  ___ _
            | |/ |/ / _ `/ __/ _ \/ / _ \/ _ `/
            |__/|__/\_,_/_/ /_//_/_/_//_/\_, /
                                        /___/
        */
        _showCountDown: function() {
            // this._cookie('multiTabSync', $.extend({ showing: true }, this._cookie('multiTabSync')));
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
            this._startTracking();
            this._startTick();
            if (this.options.multiTabSync) {
                this._cookie('multiTabSync', {
                    showing: false,
                    expired: false,
                    extended: false
                });
            }
            return this;
        }
    });
})(jQuery);