import express from "express";
import puppeteer from "puppeteer";
import validUrl from 'valid-url';
import { URL, fileURLToPath } from 'url'
import path, { dirname } from "path";
import cors from "cors"
import dotenv from 'dotenv';

import { exec } from "child_process";
dotenv.config();
const app = express();


app.use(express.json());
app.use(cors({
    origin: ["http://localhost:3000","https://network-details.vercel.app"],
}))
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(express.static(path.join(__dirname, '..', 'frontend')));

const fetchNetworkData = async (website) => {
    try {
        if (!validUrl.isUri(website)) {
            return {
                success: false,
                error: "Invalid website URL"
            };
        }

        const browser = await puppeteer.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--single-process", "--no-zygote"],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        });

        const page = await browser.newPage();
        await page.setRequestInterception(true);

        const filteredNetworkData = [];
        const destinationHostServiceRecords = {};

        page.on("request", (request) => {
            try {
                const requestUrl = request.url();
                const requestPostData = request.postData();
                const requestResourceType = request.resourceType();

                if (requestResourceType === "xhr" || requestResourceType === "fetch") {
                    const parsedUrl = new URL(requestUrl);
                    const protocolType = parsedUrl.protocol;
                    const service = parsedUrl.hostname;
                    const srcBytes = requestPostData ? requestPostData.length : 0;
                    const dstBytes = (request.headers() + requestPostData).length;

                    filteredNetworkData.push({
                        protocolType,
                        service,
                        srcBytes,
                        dstBytes,
                    });

                    if (!destinationHostServiceRecords[requestUrl]) {
                        destinationHostServiceRecords[requestUrl] = 0;
                    }
                    destinationHostServiceRecords[requestUrl]++;
                }
            } catch (err) {
                console.error("Error handling request:", err);
            }

            request.continue();
        });

        await page.goto(website);
        await page.waitForNetworkIdle();

        const totalRequests = filteredNetworkData.length;
        const sameServiceRecordCount = filteredNetworkData.filter((req) => req.service === "http").length;
        const differentServiceRecordCount = totalRequests - sameServiceRecordCount;
        const destinationHostServiceRecordCount = Object.keys(destinationHostServiceRecords).length;
        const destinationHostSameServiceRecordRate = destinationHostServiceRecordCount / totalRequests;

        const protocolType = filteredNetworkData.map((req) => req.protocolType);
        const service = filteredNetworkData.map((req) => req.service);
        const srcBytes = filteredNetworkData.map((req) => req.srcBytes);
        const dstBytes = filteredNetworkData.map((req) => req.dstBytes);

        await browser.close();

        return {
            success: true,
            data: {
                protocol_type: protocolType,
                service: service.length,
                flag: totalRequests,
                src_bytes: srcBytes,
                dst_bytes: dstBytes,
                count: totalRequests,
                same_srv_rate: sameServiceRecordCount,
                diff_srv_rate: differentServiceRecordCount,
                dst_host_srv_count: destinationHostServiceRecordCount,
                dst_host_same_srv_rate: destinationHostSameServiceRecordRate
            }
        }
    } catch (err) {
        console.error("Error in fetchNetworkData function:", err);
        return {
            success: false,
            error: "Internal server error",
            details: err.message
        };
    }
};




app.get("/", (req, res) => {
    res.send("Welcome to the Network Details API");
});

app.post("/fetchNetworkData", async (req, res) => {
    try {
        const website = req.body.website; 
        const data = await fetchNetworkData(website);
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
