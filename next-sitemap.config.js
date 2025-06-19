// next-sitemap.config.js
/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: "https://tool3.xyz",
    generateRobotsTxt: true,
    changefreq: "weekly",
    generateIndexSitemap: false,
    robotsTxtOptions: {
        policies: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/api"],
            },
        ],
    },
};