/* globals module, require */
module.exports = function(grunt) {
  'use strict';

  var pkg = require('./package.json');
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      files: ['Gruntfile.js', 'main.js'],
      options: {
        'undef': true,
        'unused': true,
        'quotmark': 'single',
        'strict': true,
        'eqeqeq': true,
        'indent': 2,
        'curly': true
      }
    },
    watch: {
      files: ['<%= jshint.files %>'],
      tasks: ['jshint']
    },
    compress: {
      main: {
        options: {
          archive: function () {
            // The global value git.tag is set by another task
            return 'handlebars-templates-' + pkg.version + '.zip';
          },
          pretty: true
        },
        files: [
          {
            expand: true,
            src: ['main.js', 'package.json', 'LICENSE'],
            dest: '/'
          }
        ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-compress');

  grunt.registerTask('default', ['jshint', 'watch']);
  grunt.registerTask('test', ['jshint']);
  grunt.registerTask('dist', ['jshint', 'compress']);
}; 