import { Product } from "./types";

export const products: Product[] = [
  {
    id: "1",
    name: "Wireless Headphones",
    price: 79.99,
    image: "/headphones.svg",
    description: "Premium wireless headphones with noise cancellation.",
  },
  {
    id: "2",
    name: "Mechanical Keyboard",
    price: 129.99,
    image: "/keyboard.svg",
    description: "Cherry MX switches, RGB backlight, full-size layout.",
  },
  {
    id: "3",
    name: "USB-C Hub",
    price: 49.99,
    image: "/hub.svg",
    description: "7-in-1 hub with HDMI, USB-A, SD card reader.",
  },
  {
    id: "4",
    name: "Monitor Stand",
    price: 39.99,
    image: "/stand.svg",
    description: "Adjustable aluminum monitor stand with cable management.",
  },
];
