import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import auth from "./auth/auth";
import matches from "./matches/matches";

// initialize environment variables
const app = express();

// GLOBAL MIDDLEWARES
app.use(
    cors({
        origin: "http://frontend",
        credentials: true,
    })
);
app.use(cookieParser());
app.use(express.json());

// ROUTES
app.use("/auth", auth);
app.use("/matches", matches);

// ERROR HANDLING
app.use((err: any, req: Request, res: Response) => {
    res.status(500);
    if (process.env.NODE_ENV === "development" || "test") {
        console.log(err.stack);
        res.send(err.message);
    } else {
        res.send("Internal Server Error");
    }
});

// REVERSE PROXY CONFIG
app.set("trust proxy", true);

export default app;
