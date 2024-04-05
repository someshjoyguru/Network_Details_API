import express from "express";
import validUrl from 'valid-url';
import chrome from "chrome-aws-lambda";
import puppeteer from "puppeteer-core";

const app = express();
app.use(express.json());

const fetchNetworkData = async (website,options) => {
    try {
        console.log(website)
        website=`https://www.${website}.com/`
        if (!validUrl.isUri(website)) {
            return {
                success: false,
                error: "Invalid website URL",
                website: website,
                websiteType: typeof website
            };
        }
        const browser = await puppeteer.launch(options);
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
                    const protocolType = requestUrl.split(":")[0];
                    const service = requestUrl.split(":")[1].replace("//", "");
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
        const sameServiceRecordCount = filteredNetworkData.filter(
            (req) => req.service === "http"
        ).length;
        const differentServiceRecordCount = totalRequests - sameServiceRecordCount;
        const destinationHostServiceRecordCount = Object.keys(
            destinationHostServiceRecords
        ).length;
        const destinationHostSameServiceRecordRate =
            destinationHostServiceRecordCount / totalRequests;
        const countValue = totalRequests;
        const protocolType = filteredNetworkData.map((req) => req.protocolType);
        const service = filteredNetworkData.map((req) => req.service);
        const srcBytes = filteredNetworkData.map((req) => req.srcBytes);
        const dstBytes = filteredNetworkData.map((req) => req.dstBytes);

        await browser.close();

        const successJSON = {
            "protocol_type": protocolType,
            "service": service.length,
            "flag": totalRequests,
            "src_bytes": srcBytes,
            "dst_bytes": dstBytes,
            "count": countValue,
            "same_srv_rate": sameServiceRecordCount,
            "diff_srv_rate": differentServiceRecordCount,
            "dst_host_srv_count": destinationHostServiceRecordCount,
            "dst_host_same_srv_rate": destinationHostSameServiceRecordRate
        }
        return {
            success: true,
            data: successJSON
        }
    }catch (err) {
        console.error("Error:", err);
        return {
            success: false,
            error: "Internal server error"
        };
    }
};

app.post("/", (req, res) => {
    res.send("Welcome to the Network Details API");
});

app.get("/", (req, res) => {
    res.send("Welcome to the Network Details API");
});

app.get("/fetchNetworkData", async (req, res) => {
    let options = {};
      if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
        options = {
          args: [...chrome.args, "--hide-scrollbars", "--disable-web-security"],
          defaultViewport: chrome.defaultViewport,
          executablePath: await chrome.executablePath,
          headless: true,
          ignoreHTTPSErrors: true,
        };
      }

    
    try {
        const website = req.params.website; 
        console.log(website);
        const data = await fetchNetworkData(website,options);
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
