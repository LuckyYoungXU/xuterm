import { Octokit } from "@octokit/rest";

const cache = new Map();
const RATE_LIMIT_MS = 300000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "LuckyYoungXU";
const STATS_REPO = "stats";
const FILE_PATH = "stats.json";

export async function GET(request) {
  try {
    if (!GITHUB_TOKEN) throw new Error("Missing GITHUB_TOKEN");
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const now = Date.now();

    // 缓存限流，短时间重复请求不重复读写仓库
    if (cache.has(action) && now - cache.get(action) < RATE_LIMIT_MS) {
      const { data } = await octokit.rest.repos.getContent({
        owner: OWNER,
        repo: STATS_REPO,
        path: FILE_PATH
      });
      const stats = JSON.parse(Buffer.from(data.content, "base64").toString());
      return Response.json(stats, { headers: { "Access-Control-Allow-Origin": "*" } });
    }
    cache.set(action, now);

    // 读取计数文件
    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: STATS_REPO,
      path: FILE_PATH
    });
    let stats = JSON.parse(Buffer.from(data.content, "base64").toString());

    // 对应动作自增
    if (action === "pageview") stats.pageView += 1;
    if (action === "download") stats.downloadClick += 1;

    // 写回文件
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: STATS_REPO,
      path: FILE_PATH,
      message: "Update statistics",
      content: Buffer.from(JSON.stringify(stats, null, 2)).toString("base64"),
      sha: data.sha
    });

    return Response.json(stats, { headers: { "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    return Response.json(
      { error: err.message },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
