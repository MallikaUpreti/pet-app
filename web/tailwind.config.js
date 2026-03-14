/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#F28C38",
          blue: "#F5A45A",
          green: "#F7B472",
          yellow: "#FAD5AE",
          black: "#0F0F0F",
          light: "#D9D3D3",
          cream: "#FFF7EF",
          mist: "#F4F7FA"
        }
      },
      fontFamily: {
        heading: ["Baloo 2", "Baloo", "Trebuchet MS", "cursive"],
        body: ["Fredoka", "Museo", "Avenir", "Segoe UI", "sans-serif"]
      },
      boxShadow: {
        soft: "0 26px 70px rgba(15, 15, 15, 0.08)",
        card: "0 20px 50px rgba(15, 15, 15, 0.09)",
        float: "0 18px 40px rgba(242, 140, 56, 0.14)"
      },
      backgroundImage: {
        "hero-wash":
          "radial-gradient(circle at top left, rgba(242, 140, 56, 0.35), transparent 36%), radial-gradient(circle at top right, rgba(245, 164, 90, 0.24), transparent 32%), linear-gradient(180deg, #fff7ef 0%, #ffffff 70%)"
      }
    }
  },
  plugins: []
};
