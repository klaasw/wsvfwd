'use strict';

const WSV = {};

$(window).load(function () {
	WSV.Admin.init();
});

(function (window, document, $) {
	WSV.Admin = {
		// Variablenn im Admin Kontexr

		init: function () {
			this.ladeServerZustand();
		},

		ladeServerZustand: function() {
			$.get('/verbindungen/liesZustand', function (data) {
				$.each(data, function (key, val) {
					let durchlaufZaehler = 1;
					//DUE Peers Zustaende setzen
					$.each(val.DUE, function (server, status) {
						$('#' + val._id + 'due' + (durchlaufZaehler)).text(status.status.state)
						$('#' + val._id + 'dueUrl' + (durchlaufZaehler)).text(status.status.url)
						$('#' + val._id + 'dueLetzteMeldung' + (durchlaufZaehler)).text(status.letzteMeldung)
						durchlaufZaehler += 1;
					})
					//SIP-Server Zustaende setzen
					$('#' + val._id + 'sipStatus').text(val['SIP-Server'].status.state)
					$('#' + val._id + 'sipUrl').text(val['SIP-Server'].status.url)
					$('#' + val._id + 'sipMsg').text(val['SIP-Server'].status.msg)
					$('#' + val._id + 'sipLetzteMeldung').text(val['SIP-Server'].letzteMeldung)

					//RFD-Server Zustaende setzen
					$('#' + val._id + 'rfdStatus').text(val.RFD.status.state)
					$('#' + val._id + 'rfdUrl').text(val.RFD.status.url)
					$('#' + val._id + 'rfdMsg').text(val.RFD.status.msg)
					$('#' + val._id + 'rfdLetzteMeldung').text(val.RFD.letzteMeldung)

					console.log(key)


				})
			})
		},



	} // WSV.Admin Ende
})(window, document, jQuery);
