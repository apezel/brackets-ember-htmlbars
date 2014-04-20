/* globals module */
module.exports = function(grunt) {
  'use strict';

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
    }
  });
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['jshint', 'watch']);
  grunt.registerTask('test', ['jshint']);
}; 