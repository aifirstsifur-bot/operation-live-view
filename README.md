# Operation Demo

這是一個可直接部署到 Netlify 的靜態網頁範例，用來展示「操作過程 / 任務紀錄」。

## 本機打開

直接用瀏覽器打開 `index.html`。

## 部署到 Netlify

### 方法一：拖拉部署

1. 登入 Netlify
2. 到 Sites
3. 把整個 `web-operation-demo` 資料夾拖進部署區
4. Netlify 會產生公開網址

### 方法二：CLI 部署

```bash
cd web-operation-demo
netlify deploy --prod --dir=.
```

## 下一步

如果要讓所有人看到同一份即時紀錄，需要再加後端或資料庫，例如 Supabase。
