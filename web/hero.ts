import { heroui } from "@heroui/react";
console.log("Loading HeroUI Tailwind Plugin");
export default heroui({
  addCommonColors: true,
  layout: {
    radius: {
      small: "8px",
      medium: "12px",
      large: "14px",
    },
    borderWidth: {
      small: "1px",
      medium: "2px",
      large: "3px",
    },
  },
});
