'use strict';

const tools = {
	/**
	 * Zahlen vergleichen: Dient als Funktion für Array.sort() da sort nur alphabetisch sortiert
	 * @param {number} a
	 * @param {number} b
	 * @returns {number}
	 */
	vergleicheZahlen(a, b) {
		return a - b;
	},

	/**
	 * filtert den IPv6 Prefix aus einer IPv4 adresse heraus
	 * @param {string} ip
	 * @returns {string}
	 */
	filterIP(ip) {
		return ip.replace('::ffff:', '');
	},

	/**
	 * Doppeleinträge aus Array entfernen.
	 * @param {Array} array
	 * @returns {Array}
	 */
	entferneDoppel(array) {
		return array.filter(function (item, position, self) {
			return self.indexOf(item) == position;
		});
	},

	/**
	 * Normalize a port into a number, string, or false.
	 * @param {int|string} val
	 * @returns {int|boolean}
	 */
	normalizePort(val) {
		const port = parseInt(val, 10);
		if (isNaN(port)) {
			// named pipe
			return val;
		}
		if (port >= 0) {
			// port number
			return port;
		}
		return false;
	}

};

module.exports = tools;
