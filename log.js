'use strict';

/**
 * The logging library used by this module.
 * @external winston
 */

const cfg = require('./cfg.js');
const winston = require('winston');
winston.emitErrs = true;

const log = new winston.Logger({
	transports: [
		new winston.transports.File({
			level: cfg.loglevelFile,
			timestamp: true,
			prettyPrint: true,
			filename: './log/ukwserver.log',
			maxsize: 5242880, //5MB
			maxFiles: 10,
			handleExceptions: true,
			json: false, //true,
			colorize: false,
			tailable: true
		}),
		new winston.transports.Console({
			level: cfg.loglevelConsole,
			timestamp: true,
			prettyPrint: true,
			handleExceptions: true,
			json: false,
			colorize: true
		})
	],
	exitOnError: false
});

module.exports = log;

/* can be used for writing winston log entries together with morgan access-log entries in one file
module.exports.stream = {
    write: function(message, encoding){
        log.info(message);
    }
};
*/
