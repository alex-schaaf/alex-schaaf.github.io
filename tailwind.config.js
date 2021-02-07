const colors = require("tailwindcss/colors")

module.exports = {
  purge: [],
  // darkMode: 'media', // or 'media' or 'class'
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '768px',
      'xl': '768px',
      '2xl': '768px',
    },
    colors: {
      white: "#FFF",
      black: "#000",
      background: "#1A202C",
      gray: colors.coolGray,
      primary: colors.green,
      red: colors.red
    },
    extend: {

    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
