import { Handler } from "@netlify/functions";
import Parser from "rss-parser";

const parser = new Parser();

export const handler: Handler = async (event) => {
  try {
    const blogId = event.queryStringParameters?.blogId || "thebeone";
    console.log(`Fetching Naver Blog RSS for: ${blogId}`);

    const feed = await parser.parseURL(`https://rss.blog.naver.com/${blogId}.xml`);
    
    const posts = feed.items.map(item => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      contentSnippet: item.contentSnippet,
      author: item.author || item.creator
    })).slice(0, 5);

    const allowedOrigin = process.env.APP_URL || process.env.VITE_APP_URL || "*";

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowedOrigin
      },
      body: JSON.stringify({ status: "success", posts }),
    };
  } catch (error) {
    console.error("RSS fetch error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ status: "error", message: "Failed to fetch blog feed" }),
    };
  }
};
