```sh
cp -R content/lectures/_template content/lectures/Lec15
# затем отредактировать content/lectures/Lec15/vitepress.md:
# - title
# - order
# - H1
# - ссылки
# - примеры
# - группы и ссылки в разделе «Дополнительное чтение»
```

Раздел `## Дополнительное чтение` автоматически попадает в общий индекс
`/extras/02`. Добавьте хотя бы одну внешнюю `http/https`-ссылку; пустой блок
остановит `content:check` с указанием файла и строки.
