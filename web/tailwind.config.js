/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#F28B3E",
          blue: "#6AA4D7",
          green: "#A8CB75",
          yellow: "#ECCE5A",
          black: "#0D0E13",
          light: "#D9D1D6",
          cream: "#F7F3F4",
          mist: "#ECE8EB"
        }
      },
      fontFamily: {
        heading: ["Baloo 2", "Baloo", "Trebuchet MS", "cursive"],
        body: ["Fredoka", "Museo", "Avenir", "Segoe UI", "sans-serif"]
      },
      boxShadow: {
        soft: "0 26px 70px rgba(13, 14, 19, 0.12)",
        card: "0 20px 50px rgba(13, 14, 19, 0.14)",
        float: "0 18px 40px rgba(242, 139, 62, 0.26)"
      },
      backgroundImage: {
        "hero-wash":
          "radial-gradient(circle at top left, rgba(242, 139, 62, 0.34), transparent 36%), radial-gradient(circle at top right, rgba(106, 164, 215, 0.28), transparent 32%), linear-gradient(180deg, #f7f3f4 0%, #ffffff 72%)"
      }
    }
  },
  plugins: []
};
