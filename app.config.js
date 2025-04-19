export default {
  expo: {
    name: "deeptalk-health",
    slug: "deeptalk-health",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "deeptalk-health",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      }
    },
    web: {
      bundler: "metro",
      favicon: "./assets/images/favicon.png"
    },
    extra: {
      linkedinClientId: process.env.LINKEDIN_CLIENT_ID || "86idq38i2uossd",
      linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    },
  }
};
