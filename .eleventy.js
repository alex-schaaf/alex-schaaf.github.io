const pluginDate = require("eleventy-plugin-date");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const markdownItFootnote = require("markdown-it-footnote");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");

let markdownLibrary = markdownIt({
  html: true,
  breaks: true,
  linkify: true,
  typographer: true,
}).use(
  markdownItAnchor, {
  permalink: true,
  permalinkClass: "direct-link",
  permalinkSymbol: "#",
}).use(markdownItFootnote);

markdownLibrary.renderer.rules.footnote_caption = (tokens, idx) => {
  let n = Number(tokens[idx].meta.id + 1).toString();

  if (tokens[idx].meta.subId > 0) {
    n += ":" + tokens[idx].meta.subId;
  }
  return n;
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(pluginDate);
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.setUseGitIgnore(false);
  eleventyConfig.setLibrary("md", markdownLibrary)
  eleventyConfig.setTemplateFormats([
    "md", "css", "jpg"
  ]);
  return {
    dir: { input: 'src', output: '_site' }
  };
};