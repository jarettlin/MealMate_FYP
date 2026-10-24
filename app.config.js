export default {
    expo: {
      name: "firstapp",
      slug: "firstapp",
      version: "1.0.0",
      orientation: "portrait",
      icon: "./assets/images/icon.png",
      scheme: "myapp",
      userInterfaceStyle: "automatic",
      newArchEnabled: false,
      ios: {
        supportsTablet: true,
        config: {
          GOOGLE_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_API_KEY
        }
      },
      android: {
        package: "com.yourcompany.firstapp",
        adaptiveIcon: {
          foregroundImage: "./assets/images/adaptive-icon.png",
          backgroundColor: "#ffffff"
        },
        config: {
          googleMaps: {
            GOOGLE_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_API_KEY
          }
        }
      },
      web: {
        bundler: "metro",
        output: "static",
        favicon: "./assets/images/favicon.png"
      },
      plugins: [
        "expo-router",
        [
          "expo-splash-screen",
          {
            image: "./assets/images/splash-icon.png",
            imageWidth: 200,
            resizeMode: "contain",
            backgroundColor: "#ffffff"
          }
        ]
      ],
      experiments: {
        typedRoutes: true
      },
      extra: {
        googleApiKey: process.env.EXPO_PUBLIC_GOOGLE_API_KEY,
        eas: {
          projectId: "c8fba06a-7051-46bd-ae29-46308a98e39c"
        }
      }
    }
  };
  
