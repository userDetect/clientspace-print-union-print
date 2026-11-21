export const business = {
  "name": "Юнион Принт",
  "slug": "union-print",
  "products": [
    {
      "id": "p1",
      "oldIndex": 0,
      "name": "Каталоги и брошюры",
      "detail": "Многостраничная офсетная полиграфия. При расчёте важно разделить характеристики обложки и блока и указать способ скрепления.",
      "group": "Издания",
      "photo": "assets/5dd294e642f1435a9d8a1ddb.webp",
      "url": "https://upnn.ru/katalogi/",
      "imageAlt": "Каталоги и брошюры"
    },
    {
      "id": "p2",
      "oldIndex": 1,
      "name": "Журналы и корпоративная пресса",
      "detail": "Периодические издания и материалы компаний",
      "group": "Книги и брошюры",
      "photo": "",
      "url": "",
      "imageAlt": "Журналы и корпоративная пресса"
    },
    {
      "id": "p3",
      "oldIndex": 2,
      "name": "Рекламная полиграфия",
      "detail": "Буклеты, календари и меню",
      "group": "Печать",
      "photo": "",
      "url": "",
      "imageAlt": "Рекламная полиграфия"
    },
    {
      "id": "p4",
      "oldIndex": 3,
      "name": "Комиксы",
      "detail": "Многостраничная печать",
      "group": "Печать",
      "photo": "",
      "url": "",
      "imageAlt": "Комиксы"
    },
    {
      "id": "p5",
      "oldIndex": 4,
      "name": "Комплектующие настольных игр",
      "detail": "При расчёте настольной игры можно раздельно перечислить печатные детали, обозначить их материалы, размеры и количество в комплекте.",
      "group": "Комплектующие",
      "photo": "",
      "url": "https://upnn.ru/nastolnye-igry/",
      "imageAlt": "Комплектующие настольных игр"
    },
    {
      "id": "p6",
      "oldIndex": 5,
      "name": "Послепечатная обработка",
      "detail": "УФ-лакирование, вырубка и другие операции для типографий",
      "group": "Подготовка и обработка",
      "photo": "",
      "url": "",
      "imageAlt": "Послепечатная обработка"
    }
  ],
  "tariffs": [],
  "fields": [
    {
      "key": "quantity",
      "label": "Тираж, шт.",
      "type": "number",
      "applies": null
    },
    {
      "key": "format",
      "label": "Формат и число страниц",
      "type": "text",
      "applies": null
    },
    {
      "key": "paper",
      "label": "Бумага, плотность и цветность",
      "type": "text",
      "applies": null
    },
    {
      "key": "finishing",
      "label": "Скрепление и отделка",
      "type": "text",
      "applies": null
    },
    {
      "key": "deadline",
      "label": "К какому дню нужен тираж",
      "type": "date",
      "applies": null
    },
    {
      "key": "pages",
      "label": "Количество страниц",
      "type": "number",
      "options": [],
      "applies": [
        0,
        1,
        3
      ]
    },
    {
      "key": "binding",
      "label": "Переплёт",
      "type": "select",
      "options": [
        "Скрепка",
        "Клеевое скрепление",
        "Уточнить"
      ],
      "applies": [
        0,
        1,
        3
      ]
    },
    {
      "key": "components",
      "label": "Состав комплекта",
      "type": "text",
      "options": [],
      "applies": [
        4
      ]
    }
  ],
  "fileLabel": "Макет или спецификация"
};
