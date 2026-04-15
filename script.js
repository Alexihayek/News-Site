// Configuration Section - Easily modify these values
const CONFIG = {
    siteName: 'News Aggregator',
    rssFeeds: {
        tech: [
            'https://feeds.bbci.co.uk/news/technology/rss.xml',
            'https://rss.cnn.com/rss/edition_technology.rss',
            'https://feeds.npr.org/1019/rss.xml', // NPR Tech
            'https://www.theverge.com/rss/index.xml',
            'https://arstechnica.com/feed/'
        ],
        finance: [
            'https://feeds.bbci.co.uk/news/business/rss.xml',
            'https://rss.cnn.com/rss/money_news_international.rss',
            'https://feeds.bloomberg.com/markets/news.rss',
            'https://www.reuters.com/rssFeed/businessNews',
            'https://feeds.marketwatch.com/marketwatch/marketpulse/'
        ],
        sports: [
            'https://feeds.bbci.co.uk/sport/rss.xml',
            'https://rss.cnn.com/rss/edition_sport.rss',
            'https://www.espn.com/espn/rss/news',
            'https://api.foxsports.com/v1/rss?partnerKey=zBaFxRyGKCfxBagJG9b8pqLyndmvo7UU',
            'https://www.cbssports.com/rss/headlines/'
        ],
        world: [
            'https://feeds.bbci.co.uk/news/world/rss.xml',
            'https://rss.cnn.com/rss/edition_world.rss',
            'https://feeds.npr.org/1001/rss.xml', // NPR World
            'https://www.aljazeera.com/xml/rss/all.xml',
            'https://www.reuters.com/rssFeed/worldNews'
        ]
    },
    // Try multiple CORS proxies for better reliability
    corsProxies: [
        'https://api.rss2json.com/v1/api.json?rss_url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://thingproxy.freeboard.io/fetch/'
    ]
};

// Global variables
let allArticles = [];
let currentCategory = 'all';

// DOM Elements
const articleGrid = document.getElementById('articleGrid');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const articleModal = document.getElementById('articleModal');
const articleContent = document.getElementById('articleContent');
const searchInput = document.getElementById('searchInput');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    updateSiteName();
    setDefaultDateRange();
    loadAllFeeds();
});

// Update site name in header
function updateSiteName() {
    document.querySelector('.logo h1').textContent = CONFIG.siteName;
}

// Set default date range to last month for better access to older news
function setDefaultDateRange() {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(today.getMonth() - 1);

    // Format dates as YYYY-MM-DD for input fields
    const formatDate = (date) => {
        return date.toISOString().split('T')[0];
    };

    startDateInput.value = formatDate(lastMonth);
    endDateInput.value = formatDate(today);
}

// Show home page (all articles)
function showHome() {
    currentCategory = 'all';
    renderArticles(allArticles);
}

// Show category page
function showCategory(category) {
    currentCategory = category;
    const categoryArticles = allArticles.filter(article => article.category === category);
    renderArticles(categoryArticles);
}

// Search articles
function searchArticles() {
    const query = searchInput.value.toLowerCase();
    const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
    const endDate = endDateInput.value ? new Date(endDateInput.value) : null;

    // If end date is set, set it to end of day
    if (endDate) {
        endDate.setHours(23, 59, 59, 999);
    }

    let filteredArticles = allArticles;

    // Filter by search query
    if (query) {
        filteredArticles = filteredArticles.filter(article =>
            article.title.toLowerCase().includes(query) ||
            article.description.toLowerCase().includes(query)
        );
    }

    // Filter by date range
    if (startDate || endDate) {
        filteredArticles = filteredArticles.filter(article => {
            const articleDate = new Date(article.pubDate);

            if (startDate && endDate) {
                return articleDate >= startDate && articleDate <= endDate;
            } else if (startDate) {
                return articleDate >= startDate;
            } else if (endDate) {
                return articleDate <= endDate;
            }

            return true;
        });
    }

    renderArticles(filteredArticles);
}

// Clear all filters
function clearFilters() {
    searchInput.value = '';
    startDateInput.value = '';
    endDateInput.value = '';
    renderArticles(allArticles);
}

// Load all RSS feeds
async function loadAllFeeds() {
    showLoading();
    allArticles = [];

    const feedPromises = [];

    // Load feeds for each category
    for (const [category, feeds] of Object.entries(CONFIG.rssFeeds)) {
        feeds.forEach(feedUrl => {
            feedPromises.push(loadFeed(feedUrl, category));
        });
    }

    try {
        await Promise.all(feedPromises);
        // Sort articles by date (newest first)
        allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        console.log(`Loaded ${allArticles.length} articles total`);

        if (allArticles.length === 0) {
            showError('No articles could be loaded. This might be due to network restrictions on GitHub Pages. Try refreshing or check the browser console for details.');
            // Show sample articles as fallback
            loadSampleArticles();
        } else {
            renderArticles(allArticles);
            hideLoading();
        }
    } catch (error) {
        console.error('Error loading feeds:', error);
        showError('Failed to load articles. Please check your internet connection and try again.');
    }
}

// Load a single RSS feed
async function loadFeed(feedUrl, category) {
    for (const proxy of CONFIG.corsProxies) {
        try {
            const proxyUrl = proxy + encodeURIComponent(feedUrl);
            console.log(`Trying to load feed: ${feedUrl} with proxy: ${proxy}`);

            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`Successfully loaded feed: ${feedUrl}`, data);

            if (data.status === 'ok' && data.items && data.items.length > 0) {
                const articles = data.items.map(item => ({
                    ...item,
                    category: category,
                    source: data.feed?.title || 'Unknown Source'
                }));
                allArticles.push(...articles);
                return; // Success, exit the loop
            } else {
                console.warn(`Feed returned status: ${data.status} for ${feedUrl}`);
            }
        } catch (error) {
            console.error(`Error loading feed ${feedUrl} with proxy ${proxy}:`, error);
            // Try next proxy
        }
    }

    console.error(`Failed to load feed ${feedUrl} with all proxies`);
}

// Load sample articles as fallback when RSS feeds fail
function loadSampleArticles() {
    console.log('Loading sample articles as fallback...');

    const sampleArticles = [
        {
            title: "Sample Tech Article: The Future of AI",
            description: "This is a sample article demonstrating the news aggregator layout. In a real deployment, this would be replaced with actual RSS feed content.",
            thumbnail: "https://via.placeholder.com/300x200?text=Tech+News",
            link: "#",
            pubDate: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            category: "tech",
            source: "Sample Source"
        },
        {
            title: "Sample Finance Article: Market Trends",
            description: "Another sample article showing how the card layout works with different categories and content.",
            thumbnail: "https://via.placeholder.com/300x200?text=Finance+News",
            link: "#",
            pubDate: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            category: "finance",
            source: "Sample Source"
        },
        {
            title: "Sample Sports Article: Championship Updates",
            description: "Sports news sample demonstrating the responsive grid layout and article cards.",
            thumbnail: "https://via.placeholder.com/300x200?text=Sports+News",
            link: "#",
            pubDate: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
            category: "sports",
            source: "Sample Source"
        },
        {
            title: "Sample World News: Global Events",
            description: "World news sample showing how the aggregator handles different types of content and sources.",
            thumbnail: "https://via.placeholder.com/300x200?text=World+News",
            link: "#",
            pubDate: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
            category: "world",
            source: "Sample Source"
        },
        {
            title: "Sample Article: Month-Old News Example",
            description: "This demonstrates how the date filtering works. You can search for articles from specific date ranges.",
            thumbnail: "https://via.placeholder.com/300x200?text=Old+News",
            link: "#",
            pubDate: new Date(Date.now() - 2592000000).toISOString(), // ~30 days ago
            category: "tech",
            source: "Sample Source"
        }
    ];

    allArticles = sampleArticles;
    renderArticles(allArticles);
    hideLoading();

    // Update error message to explain the fallback
    errorMessage.innerHTML = '<p>Showing sample articles. RSS feeds may be blocked by CORS policy on GitHub Pages. Check browser console for details.</p>';
    errorMessage.style.display = 'block';
    errorMessage.style.color = '#856404';
    errorMessage.style.backgroundColor = '#fff3cd';
    errorMessage.style.padding = '15px';
    errorMessage.style.border = '1px solid #ffeaa7';
    errorMessage.style.borderRadius = '4px';
}

// Render articles in the grid
function renderArticles(articles) {
    articleGrid.innerHTML = '';

    if (articles.length === 0) {
        articleGrid.innerHTML = '<p>No articles found matching your search criteria. Try adjusting your filters.</p>';
        return;
    }

    // Show result count
    const resultCount = document.createElement('div');
    resultCount.className = 'result-count';
    resultCount.innerHTML = `<p>Showing ${articles.length} article${articles.length !== 1 ? 's' : ''}</p>`;
    articleGrid.appendChild(resultCount);

    articles.forEach((article, index) => {
        const articleCard = createArticleCard(article);

        // Insert in-feed ad after every 4 articles
        if ((index + 1) % 4 === 0) {
            const adCard = createAdCard();
            articleGrid.appendChild(adCard);
        }

        articleGrid.appendChild(articleCard);
    });
}

// Create an article card element
function createArticleCard(article) {
    const card = document.createElement('div');
    card.className = 'article-card';

    const thumbnail = article.thumbnail || article.enclosure?.link || 'https://via.placeholder.com/300x200?text=No+Image';

    card.innerHTML = `
        <img src="${thumbnail}" alt="${article.title}" class="article-thumbnail" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
        <div class="article-content">
            <span class="article-category">${capitalizeFirstLetter(article.category)}</span>
            <h3 class="article-title">
                <a href="#" onclick="showArticle('${article.link}')">${article.title}</a>
            </h3>
            <p class="article-excerpt">${stripHtml(article.description)}</p>
            <div class="article-meta">
                <span>${article.source}</span>
                <span>${formatDate(article.pubDate)}</span>
            </div>
        </div>
    `;

    return card;
}

// Create an in-feed ad card
function createAdCard() {
    const adCard = document.createElement('div');
    adCard.className = 'article-card ad-in-feed';
    adCard.innerHTML = `
        <div class="ad-slot" style="width: 100%; height: 250px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; background: #f9f9f9;">
            Ad Placeholder - In-Feed (Responsive)
        </div>
    `;
    return adCard;
}

// Show article in modal
function showArticle(link) {
    const article = allArticles.find(a => a.link === link);
    if (article) {
        const thumbnail = article.thumbnail || article.enclosure?.link || 'https://via.placeholder.com/300x200?text=No+Image';

        articleContent.innerHTML = `
            <img src="${thumbnail}" alt="${article.title}" style="width: 100%; max-height: 300px; object-fit: cover; margin-bottom: 20px;" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
            <span class="article-category">${capitalizeFirstLetter(article.category)}</span>
            <h2>${article.title}</h2>
            <p><strong>Source:</strong> ${article.source}</p>
            <p><strong>Published:</strong> ${formatDate(article.pubDate)}</p>
            <p>${stripHtml(article.description)}</p>
            <a href="${article.link}" target="_blank" class="read-full-article">Read Full Article</a>
        `;

        articleModal.style.display = 'block';
    }
}

// Close modal
function closeModal() {
    articleModal.style.display = 'none';
}

// Utility functions
function showLoading() {
    loadingSpinner.style.display = 'block';
    errorMessage.style.display = 'none';
    articleGrid.innerHTML = '';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

function showError(message = 'Sorry, we couldn\'t load the articles right now. Please try again later.') {
    loadingSpinner.style.display = 'none';
    errorMessage.innerHTML = `<p>${message}</p>`;
    errorMessage.style.display = 'block';
}

function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target === articleModal) {
        closeModal();
    }
}