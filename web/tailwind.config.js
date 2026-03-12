/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#F28C38",
          blue: "#6FA7D6",
          green: "#A7C66B",
          yellow: "#EACB5A",
          black: "#0F0F0F",
          light: "#D9D3D3",
          cream: "#FFF7EF",
          mist: "#F4F7FA"
        }
      },
      fontFamily: {
        heading: ["Baloo", "Trebuchet MS", "cursive"],
        body: ["Museo", "Avenir", "Segoe UI", "sans-serif"]
      },
      boxShadow: {
        soft: "0 20px 45px rgba(15, 15, 15, 0.08)",
        card: "0 10px 30px rgba(111, 167, 214, 0.12)"
      },
      backgroundImage: {
        "hero-wash":
          "radial-gradient(circle at top left, rgba(242, 140, 56, 0.25), transparent 35%), radial-gradient(circle at top right, rgba(111, 167, 214, 0.22), transparent 35%), linear-gradient(180deg, #fff7ef 0%, #ffffff 70%)"
      }
    }
  },
  plugins: []
};
