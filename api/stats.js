import { Octokit } from "@octokit/rest";

const cache = new Map();
const RATE_LIMIT_MS = 300000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "LuckyYoungXU";
const STATS_REPO = "stats";
const FILE_PATH = "stats.json";

export async function GET(request) {
  console.log("当前Token是否存在：", !!GITHUB_TOKEN);
  try {
    if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN 环境变量缺失");
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const now = Date.now();

    if (cache.has(action) && now - cache.get(action) < RATE_LIMIT_MS) {
      const { data } = await octokit.rest.repos.getContent({
        owner: OWNER, repo: STATS_REPO, path: FILE_PATH
      });
      const stats = JSON.parse(Buffer.from(data.content, "base64").toString());
      return Response.json(stats, { headers: { "Access-Control-Allow-Origin": "*" } });
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
      message: "update stats count",
      content: Buffer.from(JSON.stringify(stats, null, 2)).toString("base64"),
      sha: data.sha
    });

    return Response.json(stats, { headers: { "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    console.error("函数运行错误：", err);
    return Response.json(
      { error: err.message },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
