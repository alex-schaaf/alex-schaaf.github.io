const pluginDate = require("eleventy-plugin-date");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(pluginDate);
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.setTemplateFormats([
    "md", "jpg"
  ]);
  return {
    dir: { input: 'src', output: '_site' }
  };
};