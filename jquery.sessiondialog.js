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
            resetOnActivity: false, //Reset on mouse click or key up activity in the document.
            windowFocusIsActivity: true, //If true, focus on the tab/window is considered activity.
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
        _$window: $(window), _$document: $(document), _eventNamespace: '.sessUsrEvents' + Math.floor(Math.random() * 100),
        _countDownInterval: null, _tickInterval: null, _tick: 0, _isShowing: false, _isIdle: false, _lastActivity: null,
        /*     __  ___    __  __           __
              /  |/  /__ / /_/ /  ___  ___/ /__
             / /|_/ / -_) __/ _ \/ _ \/ _  (_-<
            /_/  /_/\__/\__/_//_/\___/\_,_/___/
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
        _resetSession: function() {
            this._tick = 0;
            if (this._isShowing) {
                if (this.options.multiTabSync) {
                    this._cookie('multiTabSync', $.extend({ showing: false }, this._cookie('multiTabSync')));
                }
                this.close();
                this._isShowing = false;
                this._startTracking();
            }
        },
        _extendSession: function(fromDialog) {
            if (this.options.multiTabSync) {
                this._cookie('multiTabSync', $.extend({ showing: false, extended: true }, this._cookie('multiTabSync')));
                setTimeout($.proxy(function() {
                    this._cookie('multiTabSync', $.extend({ extended: false }, this._cookie('multiTabSync')));
                }, this), 1000);
            }
            if (fromDialog) {
                this.close();
                this._isShowing = false;
                this._startTracking();
            }
            this._trigger('extendSession', this);
        },
        _expireAndRedirect: function() {
            //Clear the times and stop tracking events.
            this._clearTimers();
            this._stopTracking();
            //Close the dialog if we need to.
            this.close();
            //We're syncing multiple tabs, so save the cookie with expired set to true for the others to pickup.
            if (this.options.multiTabSync) {
                this._cookie('multiTabSync', { expired: true });
            }
            //Trigger the event.
            this._trigger('sessionTimeout', this);
            //Redirect if possible.
            if (this.options.url) {
                console.log('REDIRECT');
                // window.location.replace(this.options.url);
            }
        },
        _startTracking: function() {
            //If we're allowed to consider a window/tab focus as user activity... hook it up.
            if (this.options.windowFocusIsActivity) {
                this._$window.on('focus' + this._eventNamespace, $.proxy(this._trackActivityHandler, this));
            }
            //Hook up click/keyup events as activity triggers.
            this._$document.on('click' + this._eventNamespace, $.proxy(this._trackActivityHandler, this)).on('keyup' + this._eventNamespace, $.proxy(this._trackActivityHandler, this));
            //Fire the tracking handler at least once to store the current time since hitting this point is considered activity.
            this._trackActivityHandler();
        },
        _stopTracking: function() {
            //Kill our event namespaces for tracking.
            this._$document.off(this._eventNamespace);
            this._$window.off(this._eventNamespace);
        },
        _clearTimers: function() {
            //Stop the count down interval if possible.
            if (this._countDownInterval) {
                clearInterval(this._countDownInterval);
            }
            //Stop the tick interval if possible.
            if (this._tickInterval) {
                clearInterval(this._tickInterval);
            }
        },
        _startTick: function() {
            //Reset the tick count, and create a new tick interval.
            this._tick = 0;
            this._tickInterval = setInterval($.proxy(this._tickHandler, this), 1000);
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
            if (this.options.multiTabSync) {
                var cookie = this._cookie('multiTabSync');
                if (cookie.expired) {
                    console.log('SOMEONE EXPIRED');
                    this._expireAndRedirect();
                    return;
                } else if (cookie.extended) {
                    console.log('SOMEONE EXTENDED');
                    this._extendSession();
                    return;
                } else if (cookie.showing && !this._isShowing && !this._isIdle) {
                    //Someone else is showing the dialog, but we're not idle yet.
                    console.log('EXTENDING... someone prematurely started counting down.');
                    this._extendSession();
                    return;
                } else if (!cookie.showing && this._isShowing) {
                    console.log('SHOWING BIT FLIPPED... RESETTING');
                    this._resetSession();
                    return;
                }
            }

            //Have we timed out?
            if (this._tick+1 >= this.options.timeoutSeconds && !this._isShowing) {
                if (!this._isIdle && this.options.resetOnActivity) {
                    //We're NOT idle so reset the activity.
                    console.log('ACTIVITY RESET');
                    this._extendSession();
                } else if (this._isIdle) {
                    //We're idle, so show the warning.
                    console.log('SHOWING');
                    this._showCountDown();
                }
            } else {
                //Nope... increment.
                this._tick++;
            }
        },
        /*   _      __              _
            | | /| / /__ ________  (_)__  ___ _
            | |/ |/ / _ `/ __/ _ \/ / _ \/ _ `/
            |__/|__/\_,_/_/ /_//_/_/_//_/\_, /
                                        /___/
        */
        _showCountDown: function() {
            //Stop all tracking so we don't reset ourself if the user sees it in time to interact.
            this._stopTracking();
            //Mark as dialog showing.
            this._isShowing = true;
            if (this.options.multiTabSync) {
                console.log('SAVING COOKIE AS SHOWING');
                this._cookie('multiTabSync', $.extend({ showing: true }, this._cookie('multiTabSync')));
            }
            //Get the total amount for the count down.
            var tick = this.options.countDownTimeout;
            //Update the count down element with it if possible.
            if (this.options.countDownElement) {
                this.options.countDownElement.text(tick);
            }
            //Trigger the event that we're showing the warning.
            this._trigger('showTimeoutWarning', this);
            //Open the dialog, and start the count down interval.
            this.open();
            this._countDownInterval = setInterval($.proxy(function() {
                //If the tick is less than or zero...
                if (tick <= 0) {
                    clearInterval(this._countDownInterval);
                    this._expireAndRedirect();
                }
                //Decrease the tick count by 1.
                tick--;
                //Set the element to the new count, if possible.
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
            //If there are some buttons defined... try to find the extend button.
            if (this.options.buttons) {
                //Loop the buttons, and try to find one with the "extendTime" property that's true.
                for(var i in this.options.buttons) {
                    if (this.options.buttons[i].hasOwnProperty('extendTime') && this.options.buttons[i].extendTime) {
                        extendButton = this.options.buttons[i];
                        break;
                    }
                }
                //If we found it, start hijacking it... otherwise, throw an error.
                if (extendButton) {
                    //Hook up a click handler for extending the time, but pass in the existing click handler just in case they bound to it.
                    extendButton.click = $.proxy(function(handler) {
                        //Extend the session.
                        this._extendSession(true);
                        //If their is a handler, and it's a function... fire it with the expected dialog content.
                        if (handler && $.isFunction(handler)) {
                            handler.call(this.element[0]);
                        }
                    }, this, extendButton.click);
                } else {
                    throw 'No button found with the extendTime option.';
                }
            }
            //Disabled autoOpen and closeOnEscape.
            this.options.autoOpen = false;
            this.options.closeOnEscape = false;
            //Create the dialog.
            $.ui.dialog.prototype._create.call(this, this.options);
            //Kill the close icone.
            this.element.parents('div.ui-dialog').find('div.ui-dialog-titlebar .ui-dialog-titlebar-close').hide();
            //Start the tracking events.
            this._startTracking();
            //If we're handling multiple tabs, then set the cookies defaults.
            if (this.options.multiTabSync) {
                this._cookie('multiTabSync', {
                    showing: false,
                    expired: false,
                    extended: false
                });
            }
            //Start the tick interval.
            this._startTick();
            //Return our instance.
            return this;
        }
    });
})(jQuery);