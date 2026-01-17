// Community Forum JavaScript
let posts = [];
let filteredPosts = [];

// Load posts from localStorage
function loadPosts() {
    const stored = localStorage.getItem('forumPosts');
    posts = stored ? JSON.parse(stored) : [];
    filteredPosts = [...posts];
    renderPosts();
}

// Save posts to localStorage
function savePosts() {
    localStorage.setItem('forumPosts', JSON.stringify(posts));
}

// Render posts
function renderPosts() {
    const container = document.getElementById('postsContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (filteredPosts.length === 0) {
        container.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    container.innerHTML = filteredPosts.map(post => `
        <div class="card-hover rounded-lg border border-border/50 bg-card text-card-foreground shadow-sm transition-all hover:border-border hover:shadow-md">
            <div class="p-5">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 min-w-0">
                        <div class="mb-2.5 flex items-center gap-2">
                            <span class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                ${post.category}
                            </span>
                            <span class="text-xs text-muted-foreground/70">${formatTime(post.createdAt)}</span>
                        </div>
                        <h3 class="mb-2 text-base font-semibold leading-snug hover:text-primary cursor-pointer transition-colors" onclick="viewPost('${post.id}')">
                            ${escapeHtml(post.title)}
                        </h3>
                        <p class="mb-4 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            ${escapeHtml(post.content)}
                        </p>
                        <div class="flex items-center gap-4 text-xs text-muted-foreground">
                            <div class="flex items-center gap-1.5">
                                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <span class="tabular-nums">${post.replies || 0}</span>
                                <span class="text-muted-foreground/70">replies</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                                <span class="tabular-nums">${post.likes || 0}</span>
                                <span class="text-muted-foreground/70">likes</span>
                            </div>
                            <div class="ml-auto flex items-center gap-1.5">
                                <div class="avatar avatar-sm bg-primary/10 text-primary">
                                    ${(post.author || 'A').charAt(0).toUpperCase()}
                                </div>
                                <span class="text-xs font-medium">${post.author || 'Anonymous'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// View post detail
function viewPost(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    // Store post in localStorage and navigate to post detail
    localStorage.setItem('currentPost', JSON.stringify(post));
    window.location.href = `post-detail.html?id=${postId}`;
}

// Format time
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

// Filter posts
function filterPosts() {
    const sortBy = document.getElementById('sortFilter').value;
    const category = document.getElementById('categoryFilter').value;
    const search = document.getElementById('searchPosts').value.toLowerCase();
    
    filteredPosts = posts.filter(post => {
        const matchesCategory = category === 'all' || post.category === category;
        const matchesSearch = !search || 
            post.title.toLowerCase().includes(search) ||
            post.content.toLowerCase().includes(search);
        return matchesCategory && matchesSearch;
    });
    
    // Sort
    filteredPosts.sort((a, b) => {
        if (sortBy === 'recent') {
            return new Date(b.createdAt) - new Date(a.createdAt);
        } else if (sortBy === 'popular') {
            return (b.likes || 0) - (a.likes || 0);
        } else if (sortBy === 'trending') {
            const aScore = (a.likes || 0) + (a.replies || 0) * 2;
            const bScore = (b.likes || 0) + (b.replies || 0) * 2;
            return bScore - aScore;
        }
        return 0;
    });
    
    renderPosts();
}

// Create new post
function createPost(title, category, content) {
    const post = {
        id: Date.now().toString(),
        title,
        category,
        content,
        author: 'You', // In a real app, this would be from user session
        createdAt: new Date().toISOString(),
        likes: 0,
        replies: 0
    };
    
    posts.unshift(post);
    savePosts();
    filterPosts();
}

// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadPosts();
    
    // New post button
    document.getElementById('newPostBtn').addEventListener('click', () => {
        document.getElementById('newPostModal').classList.remove('hidden');
    });
    
    // Close modal
    document.getElementById('closeModalBtn').addEventListener('click', () => {
        document.getElementById('newPostModal').classList.add('hidden');
    });
    
    document.getElementById('cancelPostBtn').addEventListener('click', () => {
        document.getElementById('newPostModal').classList.add('hidden');
        document.getElementById('newPostForm').reset();
    });
    
    // Submit form
    document.getElementById('newPostForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('postTitle').value;
        const category = document.getElementById('postCategory').value;
        const content = document.getElementById('postContent').value;
        
        createPost(title, category, content);
        document.getElementById('newPostModal').classList.add('hidden');
        document.getElementById('newPostForm').reset();
    });
    
    // Filters
    document.getElementById('sortFilter').addEventListener('change', filterPosts);
    document.getElementById('categoryFilter').addEventListener('change', filterPosts);
    document.getElementById('searchPosts').addEventListener('input', filterPosts);
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
