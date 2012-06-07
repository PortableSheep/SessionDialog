/*!
 * SessionDialog jQuery UI widget v1.0 - http://portablesheep.github.com/SessionDialog
 * Copyright 2012, Michael Gunderson - Dual licensed under the MIT or GPL Version 2 licenses. Same as jQuery.
 */
(function($) {
    $.widget('ui.sessiondialog', $.ui.dialog, {
        options: {
            url: null,
            timeoutInterval: 1800000,
            countDownTimeout: 20,
            countDownElement: null,
            resetOnActivity: false
        },
        _mainTimeout: null, _countDownInterval: null,
        _$document: $(document), _eventNamespace: '.sessUsrEvents' + Math.floor(Math.random() * 100),
        _showTimeout: function() {
            this._trigger('showTimeoutWarning', this);
            this.open();
        },
        _hideTimeout: function() {
            this._trigger('hideTimeoutWarning', this);
            this.close();
        },
        _setTrackingEvents: function() {
            if (this.options.resetOnActivity) {
                var self = this;
                this._$document.on('click' + this._eventNamespace, function() {
                    self._resetSession.call(self, true);
                }).on('keyup' + this._eventNamespace, function() {
                    self._resetSession.call(self, true);
                });
            }
        },
        _stopTrackingEvents: function() {
            if (this.options.resetOnActivity) {
                this._$document.off(this._eventNamespace);
            }
        },
        _clearTimers: function() {
            if (this._countDownInterval) {
                clearInterval(this._countDownInterval);
            }
            if (this._mainTimeout) {
                clearTimeout(this._mainTimeout);
            }
        },
        _sessionTimeoutWarning: function() {
            this._stopTrackingEvents();
            var tick = this.options.countDownTimeout, self = this;
            if (this.options.countDownElement) {
                this.options.countDownElement.text(tick);
            }
            this._showTimeout();
            this._countDownInterval = setInterval(function() {
                if (tick <= 0) {
                    clearInterval(self._countDownInterval);
                    self._trigger('sessionTimeout', self);
                    self.close();
                    if (self.options.url) {
                        window.location.replace(self.options.url);
                    }
                }
                tick--;
                if (self.options.countDownElement) {
                    self.options.countDownElement.text(tick);
                }
            }, 1000);
        },
        _extendSession: function() {
            this._trigger('extendSession', this);
            this._resetSession();
        },
        _resetSession: function(fromTracking) {
            var self = this;
            this._clearTimers();
            this._mainTimeout = setTimeout(function() {
                self._sessionTimeoutWarning.call(self);
            }, this.options.timeoutInterval);
            if (!fromTracking) {
                this._hideTimeout();
                this._stopTrackingEvents();
                this._setTrackingEvents();
            }
        },
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
                    var oldClickHandler = null;
                    if (extendButton.hasOwnProperty('click')) {
                        oldClickHandler = extendButton.click;
                        extendButton.click = function() {
                            self._extendSession();
                            oldClickHandler.call(this);
                        };
                    }
                } else {
                    throw 'No button found with the extendTime option.';
                }
            }
            $.ui.dialog.prototype._create.call(this, this.options);
            this.element.parents('div.ui-dialog').find('div.ui-dialog-titlebar a.ui-dialog-titlebar-close').hide();
            this._resetSession();
            return this;
        }
    });
})(jQuery);