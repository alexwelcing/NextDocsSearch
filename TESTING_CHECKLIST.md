# Testing Checklist - Article Image Slideshow Feature

## 🎯 Quick Test URLs

**Article Page:**
```
https://alexwelcing-next-docs-search-git-claude-add-article-image-slideshow-gy20e-alexwelcings-projects.vercel.app/articles/when-post-scarcity-destroyed-civilization-infinite-abundance-zero-motivation
```

**API Endpoint:**
```
https://alexwelcing-next-docs-search-git-claude-add-article-image-slideshow-gy20e-alexwelcings-projects.vercel.app/api/media/all-images?slug=when-post-scarcity-destroyed-civilization-infinite-abundance-zero-motivation
```

---

## ✅ Test 1: Article Image Slideshow

### Visual Tests
- [ ] **Gallery section appears** below article classification
- [ ] **"Article Gallery"** title visible with image icon
- [ ] **Image counter** shows (e.g., "1 / 2")
- [ ] **Main image** loads and displays properly
- [ ] **Thumbnails** appear in strip below main image
- [ ] **Type badges** show ("AI" for artwork, "IMG" for media)

### Interaction Tests
- [ ] **Click thumbnail** - switches to that image
- [ ] **Left/Right arrows** - navigate between images
- [ ] **Click main image** - opens fullscreen modal
- [ ] **Fullscreen navigation** - arrows work in fullscreen
- [ ] **Escape key** - closes fullscreen
- [ ] **Arrow keys** - navigate in fullscreen

### Debug Mode Tests (Press Shift+D)
- [ ] **Debug panel appears** with yellow border
- [ ] **Shows image count** and article slug
- [ ] **Image URLs visible** for each image
- [ ] **URLs contain** `/article-artwork/` NOT `/media/`
- [ ] **Console logs** show successful image loads

### Expected Console Logs
```javascript
[ArticleImageSlideshow] Fetched 2 images for article: ...
[ArticleImageSlideshow] Images: [...]
[ArticleImageSlideshow] Successfully loaded image: https://...
```

---

## ✅ Test 2: API Endpoint

### Test in Browser
Open API URL in browser and check JSON response:

**Expected Structure:**
```json
{
  "success": true,
  "images": [
    {
      "id": "artwork-123",
      "url": "https://[project].supabase.co/storage/v1/object/public/article-artwork/...",
      "type": "artwork",
      "title": "Generated with [model]",
      "is_selected": true,
      ...
    }
  ],
  "selectedImage": { ... },
  "count": 2
}
```

**Validate:**
- [ ] **HTTP 200** status
- [ ] **success: true** in JSON
- [ ] **images array** has items
- [ ] **URLs include** `article-artwork` bucket
- [ ] **selectedImage** is populated (or auto-selected)

---

## ✅ Test 3: 3D Scene (Home Page)

### Load Home Page
- [ ] **3D scene renders** without errors
- [ ] **No "c.target" error** in console
- [ ] **Orbit controls work** - can drag to rotate
- [ ] **Background panorama** loads
- [ ] **"Home" button** visible in top-left
- [ ] **Tablet UI** slides up from bottom

### Console Check
Look for these errors (should NOT appear):
- ❌ `TypeError: undefined is not an object (evaluating 'c.target')`
- ❌ `OrbitControls: Unable to attach to canvas`
- ❌ Failed to load image errors

---

## ✅ Test 4: Performance

### Page Load
- [ ] **Article page** loads in < 3 seconds
- [ ] **Images start loading** immediately
- [ ] **No layout shift** when slideshow appears
- [ ] **Smooth transitions** between images

### Network Tab (F12 → Network)
- [ ] **API request** completes quickly (< 500ms)
- [ ] **Images load** from Supabase
- [ ] **No 404 errors** on image requests
- [ ] **Proper caching** (check Cache-Control headers)

---

## ✅ Test 5: Mobile Responsiveness

### Mobile View (Resize browser or use DevTools)
- [ ] **Slideshow responsive** on small screens
- [ ] **Thumbnails scrollable** horizontally
- [ ] **Touch navigation** works
- [ ] **Fullscreen** works on mobile
- [ ] **No horizontal overflow**

---

## ✅ Test 6: Edge Cases

### No Images Scenario
Test an article with no artwork:
- [ ] **Slideshow hidden** (not shown at all)
- [ ] **No errors** in console
- [ ] **Page renders normally**

### Single Image
- [ ] **No navigation arrows**
- [ ] **No thumbnail strip**
- [ ] **Still opens fullscreen** on click

### Multiple Images
- [ ] **Arrows visible**
- [ ] **Thumbnails visible**
- [ ] **Loops correctly** (last → first, first → last)

---

## 🐛 Common Issues & Solutions

### Issue: Images Not Loading
**Check:**
1. Console errors mentioning CORS or 403
2. Network tab showing failed requests
3. Image URLs in debug mode (Shift+D)
4. Bucket name should be `article-artwork` not `media`

### Issue: Slideshow Not Appearing
**Check:**
1. API response (open URL directly)
2. Console for fetch errors
3. React component mounting (check React DevTools)

### Issue: 3D Scene Error
**Check:**
1. Console for "c.target" or OrbitControls errors
2. Canvas element exists before controls attach
3. Browser WebGL support

---

## 📊 Testing Results Template

Copy and fill this out:

```
## Test Results - [Date]

**Browser:** [Chrome/Firefox/Safari] [Version]
**Device:** [Desktop/Mobile] [OS]
**Deployment:** [git SHA or Vercel URL]

### Slideshow
- [ ] PASS / FAIL - Images load
- [ ] PASS / FAIL - Navigation works
- [ ] PASS / FAIL - Fullscreen works
- [ ] PASS / FAIL - Debug mode shows correct URLs

### 3D Scene
- [ ] PASS / FAIL - Scene loads without errors
- [ ] PASS / FAIL - Orbit controls work
- [ ] PASS / FAIL - No console errors

### Performance
- Page load time: [X seconds]
- Image load time: [X seconds]
- Any issues: [describe]

### Screenshots
[Attach or link to screenshots here]

### Console Errors
```
[Copy any errors here]
```

### Notes
[Any additional observations]
```

---

## 🚀 Quick Validation Script

Run this in browser console on article page:

```javascript
// Check if slideshow mounted
const slideshow = document.querySelector('[data-testid="article-image-slideshow"]') ||
                  document.querySelector('.SlideshowWrapper');
console.log('Slideshow found:', !!slideshow);

// Check API
fetch(window.location.origin + '/api/media/all-images?slug=' +
      window.location.pathname.split('/').pop())
  .then(r => r.json())
  .then(data => {
    console.log('API Success:', data.success);
    console.log('Image Count:', data.count);
    console.log('Images:', data.images);
    console.log('URLs use correct bucket:',
      data.images.every(img => img.url.includes('article-artwork'))
    );
  });

// Check for errors
console.log('Errors:', performance.getEntriesByType('navigation'));
```

---

## ✨ Success Criteria

The feature is **COMPLETE** when:
- ✅ All slideshow interactions work
- ✅ Images load from correct Supabase bucket
- ✅ Debug mode shows proper URLs
- ✅ No console errors
- ✅ 3D scene works without OrbitControls error
- ✅ Performance is acceptable (< 3s load)
- ✅ Mobile responsive
- ✅ Edge cases handled gracefully
