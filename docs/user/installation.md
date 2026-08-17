# インストール

Instant Translator は、ローカルで動く `llama.cpp` サーバへ接続して翻訳する Web アプリである。
アプリ自身は `llama.cpp` を同梱も起動もしないため、次の二つを別々に用意する。

1. `llama.cpp` サーバとモデル
2. Instant Translator のアプリ

## 前提

- Apple Silicon の Mac。
- 単一利用者での利用。
- Node.js `^20.19.0 || >=22.12.0` と npm。
- Homebrew（`llama.cpp` の導入に使う）。

## 1. llama.cpp を導入する

Homebrew で導入する。

```sh
brew install llama.cpp
```

導入すると `llama-server` コマンドが使えるようになる。

## 2. モデルを取得して起動する

使用モデルは
[`LiquidAI/LFM2.5-1.2B-JP-202606-GGUF`](https://huggingface.co/LiquidAI/LFM2.5-1.2B-JP-202606-GGUF)
の 8-bit 量子化（`Q8_0`）である。次のコマンドはモデルを取得してからサーバを起動する。
初回はダウンロードのぶん時間がかかる。

```sh
llama-server -hf LiquidAI/LFM2.5-1.2B-JP-202606-GGUF:Q8_0
```

`llama-server` は既定で `127.0.0.1` の `8080` 番ポートで待ち受ける。
Instant Translator の既定の接続先も同じなので、追加のオプションは要らない。
ポートを変える場合は[設定](configuration.md)を見る。

起動できたかどうかは、別のターミナルから確認できる。
`{"status":"ok"}` が返れば、モデルの読み込みまで完了している。

```sh
curl http://127.0.0.1:8080/health
```

モデルには Liquid AI のライセンスが適用される。条件は Hugging Face のリポジトリにある `LICENSE`
を確認する。

## 3. アプリを導入する

リポジトリを取得したディレクトリで、依存をインストールする。

```sh
npm install
```

## 次に読む

- [設定](configuration.md) — 接続先、量子化の選択、`llama-server` の起動オプション
- [使い方](usage.md) — アプリの起動と画面の操作
