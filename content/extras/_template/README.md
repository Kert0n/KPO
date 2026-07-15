```sh
cp -R content/extras/_template content/extras/NN
# затем отредактировать content/extras/NN/vitepress.md:
# - title
# - order
# - H1
# - группы и ссылки в разделе «Дополнительное чтение»
# route станет /extras/NN
```

Раздел `## Дополнительное чтение` автоматически попадает в общий индекс
`/extras/02`. Добавьте хотя бы одну внешнюю `http/https`-ссылку; пустой блок
остановит `content:check` с указанием файла и строки.
