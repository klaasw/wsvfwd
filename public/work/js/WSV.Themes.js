'use strict';

(function (window, document, $) {

	WSV.Themes = {

		path:         'stylesheets/bootstrap',
		list:         {
			'bootstrap-theme': 'bootstrap-theme.css',
			'darkly':          'darkly.css',
			'flatly':          'flatly.css',
			'cyborg':          'cyborg.css',
		},
		currentTheme: 'bootstrap-theme',

		init: function () {

			const _self = this;
			this.currentTheme = $('#theme-switcher li.active .switch-theme').data('theme');

			$('#theme-switcher .switch-theme').on('click', function (ev) {
				_self.switch($(this).data('theme'), true);
				ev.preventDefault();
				return false;
			});
		},

		/**
		 * Liefert die aktuelle Theme-URL zurück
		 * @returns {string} - relativer Pfad zum aktuellen Theme
		 */
		getThemeUrl: function () {
			return this.path + '/' + this.list[this.currentTheme];
		},

		/**
		 * Wechselt das aktuelle Theme im Frontend und speichert die Konfiguration
		 * @param {string} theme - das zu wechselnde Theme
		 * @param {boolean} saveConfig - legt fest ob die Konfig gespeichert werden soll
		 */
		switch: function (theme, saveConfig) {
			if (typeof theme == 'undefined' || theme == this.currentTheme) {
				return;
			}

			const _self = this;
			this.currentTheme = theme;

			$('#theme-switcher .switch-theme').parents('li').removeClass('active');
			$('#theme-switcher a[data-theme="' + this.currentTheme + '"]').parent().addClass('active');

			if (saveConfig) {
				WSV.Display.schreibeBenutzer(function() {
					$('#themesheet').attr('href', _self.getThemeUrl());
				});
			}
			else {
				$('#themesheet').attr('href', _self.getThemeUrl());
			}
		}
	}
})(window, document, jQuery);