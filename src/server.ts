import connectDB from "./config/db";
import app from "./app";

const PORT = process.env.PORT || 3000;

// Connect to Database and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
});
