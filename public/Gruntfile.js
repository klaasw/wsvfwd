module.exports = function (grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		sass: {
			dist: {
				options: {
					style: 'compressed',
					compass: true
				},
				files: {
					'_temp/styles.css': 'work/scss/styles.scss'
				}
			},
			dev: {
				options: {
					sourcemap: 'inline',
					style: 'expanded',
					compass: true
				},
				files: {
					'_temp/styles.css': 'work/scss/styles.scss'
				}
			}
		},

		concat: {
			options: {
				separator: ';'
			},
			init: {
				src: ['work/js/**/*.js', 'work/js/main.js'],
				dest: '_temp/main.js'
			}
		},
		uglify: {
			my_target: {
				options: {
					beautify: true,
					compress: {
						drop_console: true
					},
					sourceMap: true,
					// sourceMapRoot: '/resources/base/js/dist/'
				},
				files: {
					'_temp/main.js': ['_temp/main.js'],
				}
			}
		},
		copy: {
			css_dist: {
				expand: true,
				cwd: '_temp',
				src: [
					'styles.css',
					'styles.css.map'
				],
				dest: 'stylesheets/dist/'
			},
			js_dist: {
				expand: true,
				cwd: '_temp',
				src: [
					'main.js'
				],
				dest: 'javascripts/dist'
			},
		},
		watch: { // heres what happens while watching task runs
			options: {
//				spawn: false
			},
			css: {
				files: 'work/scss/**/*.scss',
				tasks: ['sass:dev']
			},
			js: {
				files: ['work/js/**/*.js', 'work/js/main.js'],
				tasks: ['concat'] // , 'uglify'
			},
			comp: {
				files: ['_temp/*.*'],
				tasks: ['newer:copy']
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-sass');
	grunt.loadNpmTasks('grunt-contrib-compass');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-newer');

	grunt.registerTask('default', ['watch']);
	grunt.registerTask('dist', ['sass:dist', 'concat', 'newer:copy']);
	grunt.registerTask('dev', ['sass:dev', 'concat', 'newer:copy']);

};