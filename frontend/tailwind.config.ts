import type { Config } from "tailwindcss";

const config: Config = {
    content: ["./src/pages/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}", "./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
    theme: {
        extend: {
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
            },
            screens: {
                "short-mobile": {
                    raw: "(max-height: 700px) and (max-width: 639px)",
                },
            },
            colors: {
                beige: {
                    "50": "#f8f1ec",
                    "100": "#f4e7dd",
                    "200": "#e6d0bc",
                    "300": "#d9b99b",
                    "400": "#cfa681",
                    "500": "#c38f65",
                    "600": "#b87f56",
                    "700": "#a26944",
                    "800": "#875b40",
                    "900": "#725037",
                    "950": "#463020",
                },
            },
        },
    },
    plugins: [],
};
export default config;
