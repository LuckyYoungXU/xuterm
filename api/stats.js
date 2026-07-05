import { Octokit } from "@octokit/rest";

const cache = new Map();
const RATE_LIMIT_MS = 300000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "LuckyYoungXU";
const STATS_REPO = "stats";
const FILE_PATH = "stats.json";

export default async function handler(req) {
  console.log("当前Token是否存在：", !!GITHUB_TOKEN);
  try {
    if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN 未加载");
    const octokit = new Octokit({
      auth: GITHUB_TOKEN,
      request: { redirect: "manual" } // 禁止自动跟随跳转，捕获302
    });
    const url = new URL(req.url, "http://localhost");
    const action = url.searchParams.get("action");
    const now = Date.now();

    if (cache.has(action) && now - cache.get(action) < RATE_LIMIT_MS) {
      const { data } = await octokit.rest.repos.getContent({
        owner: OWNER, repo: STATS_REPO, path: FILE_PATH
      });
      const stats = JSON.parse(Buffer.from(data.content, "base64").toString());
      return new Response(JSON.stringify(stats), {
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
      });
    }
    cache.set(action, now);

    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER, repo: STATS_REPO, path: FILE_PATH
    });
    let stats = JSON.parse(Buffer.from(data.content, "base64").toString());

    if (action === "pageview") stats.pageView += 1;
    if (action === "download") stats.downloadClick += 1;

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: OWNER, repo: STATS_REPO, path: FILE_PATH,
      message: "update stats",
      content: Buffer.from(JSON.stringify(stats, null, 2)).toString("base64"),
      sha: data.sha
    });

    return new Response(JSON.stringify(stats), {
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("API错误完整日志：", err);
    if (err.status === 302) console.error("GitHub跳转地址：", err.headers.location);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
