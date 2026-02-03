const MENU = {
    "promocoes_do_dia": [
        {
            id: "cmb-1",
            nome: "Combo Hossomaki (20 ou 40 un)",
            desc: "Mix de Salmon, Pepino, Kani e Kani c/ Pepino.",
            opcoes: [
                { tamanho: "20 Unidades", preco: 70000 },
                { tamanho: "40 Unidades", preco: 125000 }
            ],
            img: "https://images.unsplash.com/photo-1579584425555-d3715dfd93fe?w=500&q=80",
            destaque: true
        },
        {
            id: "cmb-3",
            nome: "Combo Completo Premium",
            desc: "Sashimi, Niguiri, Uramaki, Hot Roll e Hossomaki.",
            opcoes: [
                { tamanho: "25 Unidades", preco: 99000 },
                { tamanho: "50 Unidades", preco: 189000 }
            ],
            img: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=500&q=80",
            destaque: true
        }
    ],
    "combos": [
        {
            id: "cmb-1",
            nome: "Combo 1 (Hossomakis)",
            desc: "Salmon, Pepino, Kani e Kani c/ Pepino.",
            opcoes: [
                { tamanho: "20 Unidades", preco: 70000 },
                { tamanho: "40 Unidades", preco: 125000 }
            ],
            img: "https://images.unsplash.com/photo-1579584425555-d3715dfd93fe?w=500&q=80"
        },
        {
            id: "cmb-2",
            nome: "Combo 2 (Uramakis e Niguiris)",
            desc: "Uramaki (Camarão, Salmão, Kani) e Niguiris.",
            opcoes: [
                { tamanho: "19 Unidades", preco: 70000 },
                { tamanho: "38 Unidades", preco: 125000 }
            ],
            img: "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=500&q=80"
        },
        {
            id: "cmb-3",
            nome: "Combo 3 (Completo)",
            desc: "Sashimi, Niguiri, Uramaki, Hot Roll e Hossomaki.",
            opcoes: [
                { tamanho: "25 Unidades", preco: 99000 },
                { tamanho: "50 Unidades", preco: 189000 }
            ],
            img: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=500&q=80"
        }
    ],
    // --- NOVO: POKE (MONTAGEM) ---
    "pokes": [
        {
            id: "poke-build",
            nome: "Monte seu Poke (Médio)",
            desc: "Escolha: 1 Base, 2 Proteínas, 3 Acompanhamentos, 1 Molho e Chips.",
            preco: 45000,
            img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80",
            // AQUI ESTÁ A MÁGICA DA MONTAGEM:
            montagem: [
                { 
                    titulo: "1. Escolha a Base (Max 1)", 
                    max: 1, 
                    itens: ["Arroz Shari (Sushi)", "Arroz Integral", "Mix de Folhas"] 
                },
                { 
                    titulo: "2. Escolha a Proteína (Max 2)", 
                    max: 2, 
                    itens: ["Salmão Fresco", "Salmão Grelhado", "Atum", "Camarão", "Shimeji", "Kani"] 
                },
                { 
                    titulo: "3. Molho (Max 1)", 
                    max: 1, 
                    itens: ["Tarê", "Shoyu", "Ponzu", "Acevichado", "Spicy"] 
                },
                { 
                    titulo: "4. Acompanhamentos (Max 3)", 
                    max: 3, 
                    itens: ["Sunomono", "Manga", "Abacate", "Cream Cheese", "Cebola Roxa", "Tomate Cereja", "Cenoura"] 
                },
                { 
                    titulo: "5. Chips / Crocância (Max 1)", 
                    max: 1, 
                    itens: ["Batata Doce", "Alho Poró", "Amendoim", "Crispy de Couve"] 
                }
            ]
        }
    ],
    "niguiris": [
        {
            id: "nig-sal",
            nome: "Niguiri Salmon",
            desc: "Lâmina de salmão sobre arroz (Crú ou Gratinado).",
            preco: 30000, 
            img: "https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=500&q=80"
        },
        {
            id: "nig-kan",
            nome: "Niguiri Kani",
            desc: "Kani sobre arroz (Crú ou Gratinado).",
            preco: 28000, 
            img: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&q=80"
        }
    ],
    "hossomakis": [
        { id: "hos-kan", nome: "Hossomaki Kani", preco: 20500, desc: "5 unidades" },
        { id: "hos-tro", nome: "Hossomaki Tropical", desc: "Manga, Kani e Pepino (5 unidades)", preco: 22500 },
        { id: "hos-sal", nome: "Hossomaki Salmon", desc: "5 unidades", preco: 23500 },
        { id: "hos-cam", nome: "Hossomaki Camaron", desc: "5 unidades", preco: 23500 },
        { id: "hos-top", nome: "Hossomaki Top", desc: "Tomate Seco, Pepino e Kani (5 unidades)", preco: 24500 }
    ],
    "uramakis": [
        { id: "ura-sal", nome: "Uramaki Salmon", desc: "5 unidades", preco: 22500 },
        { id: "ura-cam", nome: "Uramaki Camaron", desc: "5 unidades", preco: 22500 },
        { id: "ura-tro", nome: "Uramaki Tropical", desc: "Manga, Kani e Pepino (5 unidades)", preco: 22500 },
        { id: "ura-kan", nome: "Uramaki Kani", desc: "5 unidades", preco: 22500 }
    ],
    "joys": [
        { id: "joy-rom", nome: "Joy Romeu e Julieta", desc: "Goiabinha (5 unidades)", preco: 22000 },
        { id: "joy-mbu", nome: "Joy Salmon c/ Maracujá", desc: "Geleia de Mburucuya (5 unidades)", preco: 29000 },
        { id: "joy-pim", nome: "Joy Salmon c/ Pimenta", desc: "Geleia de Pimenta (5 unidades)", preco: 29000 },
        { id: "joy-biq", nome: "Joy Salmon Biquinho", desc: "Com Pimenta Biquinho (5 unidades)", preco: 29000 },
        { id: "joy-cou", nome: "Joy Salmon Crispy", desc: "Com Couve Crispy (5 unidades)", preco: 29000 }
    ],
    "hot_rolls": [
        { id: "hot-ban", nome: "Hot Roll Banana", desc: "Banana, Canela e Doce de Leite (5 un)", preco: 25500 },
        { id: "hot-sal", nome: "Hot Roll Salmon", desc: "5 unidades", preco: 27500 },
        { id: "hot-cam", nome: "Hot Roll Camaron", desc: "5 unidades", preco: 27500 },
        { id: "hot-kan", nome: "Hot Roll Kani", desc: "5 unidades", preco: 27500 }
    ],
    "temakis_crus": [
        { id: "tmk-c-arr", nome: "Arroz con Cream Cheese", preco: 20000, img: "https://images.unsplash.com/photo-1615887023516-9b6bcd559e87?w=500&q=80" },
        { id: "tmk-c-sal", nome: "Salmon y Cream Cheese", preco: 36000, img: "https://images.unsplash.com/photo-1615887023516-9b6bcd559e87?w=500&q=80" },
        { id: "tmk-c-gra", nome: "Salmon Gratinado y Cream Cheese", preco: 36000, img: "https://images.unsplash.com/photo-1615887023516-9b6bcd559e87?w=500&q=80" },
        { id: "tmk-c-ska", nome: "Salmon, Kani y Cream Cheese", preco: 36000, img: "https://images.unsplash.com/photo-1615887023516-9b6bcd559e87?w=500&q=80" },
        { id: "tmk-c-sca", nome: "Salmon, Camaron y Cream Cheese", preco: 36000, img: "https://images.unsplash.com/photo-1615887023516-9b6bcd559e87?w=500&q=80" },
        { id: "tmk-c-cam", nome: "Camaron y Cream Cheese", preco: 36000, img: "https://images.unsplash.com/photo-1615887023516-9b6bcd559e87?w=500&q=80" },
        { id: "tmk-c-kan", nome: "Kani y Cream Cheese", preco: 36000, img: "https://images.unsplash.com/photo-1615887023516-9b6bcd559e87?w=500&q=80" },
        { id: "tmk-c-cos", nome: "Costilla Vacuna con Cream Cheese", preco: 36000, img: "https://images.unsplash.com/photo-1615887023516-9b6bcd559e87?w=500&q=80" }
    ],
    "temakis_fritos": [
        { id: "tmk-f-arr", nome: "Arroz con Cream Cheese (Frito)", preco: 25000 },
        { id: "tmk-f-sal", nome: "Salmon y Cream Cheese (Frito)", preco: 41000 },
        { id: "tmk-f-gra", nome: "Salmon Gratinado y CC (Frito)", preco: 41000 },
        { id: "tmk-f-ska", nome: "Salmon, Kani y CC (Frito)", preco: 41000 },
        { id: "tmk-f-sca", nome: "Salmon, Camaron y CC (Frito)", preco: 41000 },
        { id: "tmk-f-cam", nome: "Camaron y Cream Cheese (Frito)", preco: 41000 },
        { id: "tmk-f-kan", nome: "Kani y Cream Cheese (Frito)", preco: 41000 },
        { id: "tmk-f-cos", nome: "Costilla Vacuna y CC (Frito)", preco: 41000 }
    ],
    "temakis_premium": [
        { id: "tmk-p-cam", nome: "Camaron Salteados en Manteca", desc: "Especial Premium", preco: 45000 },
        { id: "tmk-p-sar", nome: "Salmon y Cream Cheese sin Arroz", desc: "Sem arroz", preco: 55000 },
        { id: "tmk-p-scc", nome: "Salmon (Sin Cream Cheese)", desc: "Apenas salmão", preco: 57000 }
    ],
    "hand_rolls": [
        { id: "hr-pol", nome: "Pollo con Cream Cheese", preco: 20000 },
        { id: "hr-kan", nome: "Kani y Cream Cheese", preco: 30000 },
        { id: "hr-dor", nome: "Doritos y Cream Cheese", preco: 30000 },
        { id: "hr-sal", nome: "Salmon y Cream Cheese", preco: 35000 },
        { id: "hr-gra", nome: "Salmon Gratinado y Cream Cheese", preco: 35000 },
        { id: "hr-ska", nome: "Salmon, Kani y Cream Cheese", preco: 39000 },
        { id: "hr-cam", nome: "Camaron y Cream Cheese", preco: 39000 },
        { id: "hr-sca", nome: "Salmon, Camaron y Cream Cheese", preco: 39000 }
    ],
    "sushi_dogs": [
        { id: "sd-kan", nome: "Sushi Dog Kani", preco: 45000 },
        { id: "sd-sal", nome: "Sushi Dog Salmon (Crú o Gratinado)", preco: 45000 },
        { id: "sd-cam", nome: "Sushi Dog Camaron", preco: 45000 },
        { id: "sd-ska", nome: "Sushi Dog Salmon y Kani", preco: 45000 },
        { id: "sd-sca", nome: "Sushi Dog Salmon y Camaron", preco: 45000 },
        { id: "sd-ban", nome: "Sushi Dog Banana con Nutella", preco: 45000 },
        { id: "sd-cos", nome: "Sushi Dog Costilla Vacuna", preco: 45000 }
    ],
    "ceviches": [
        { id: "cev-sal", nome: "Ceviche Salmon", preco: 30000 },
        { id: "cev-til", nome: "Ceviche Tilapia", preco: 30000 },
        { id: "cev-lul", nome: "Ceviche Lula", preco: 30000 },
        { id: "cev-cam", nome: "Ceviche Camaron", preco: 30000 },
        { id: "cev-mix", nome: "Ceviche Mixto (2 Proteinas)", preco: 30000 }
    ],
    "yakissobas": [
        { id: "yak-veg", nome: "Yakissoba Veggie", preco: 32000, peso: "750g" },
        { id: "yak-car", nome: "Yakissoba Carne", preco: 40000, peso: "750g" },
        { id: "yak-pol", nome: "Yakissoba Pollo", preco: 40000, peso: "750g" },
        { id: "yak-cam", nome: "Yakissoba Camaron", preco: 45000, peso: "750g" }
    ],
    "sushi_burgers": [
        { id: "bur-sal", nome: "Sushi Burguer Salmon", preco: 60000, peso: "650g" },
        { id: "bur-cam", nome: "Sushi Burguer Camaron", preco: 60000, peso: "650g" },
        { id: "bur-kan", nome: "Sushi Burguer Kani", preco: 60000, peso: "650g" }
    ],
    "porcoes": [
        { id: "por-cam", nome: "Camaron Empanizado", desc: "Só a proteína", preco: 90000 },
        { id: "por-cam-fr", nome: "Camaron Empanizado + Fritas/Mandioca", preco: 100000 },
        { id: "por-lul", nome: "Calamar Empanizado (Lula)", desc: "Só a proteína", preco: 79000 },
        { id: "por-lul-fr", nome: "Calamar Empanizado + Fritas/Mandioca", preco: 89000 },
        { id: "por-pes", nome: "Pescado Empanizado", desc: "Só a proteína", preco: 69000 },
        { id: "por-pes-fr", nome: "Pescado Empanizado + Fritas/Mandioca", preco: 79000 },
        { id: "por-til", nome: "Tilapia Empanizada", desc: "Só a proteína", preco: 79000 },
        { id: "por-til-fr", nome: "Tilapia Empanizada + Fritas/Mandioca", preco: 89000 },
        { id: "por-pre", nome: "Porção Premium (Mista 1.5kg)", desc: "Camarão, Peixe, Fritas e Mandioca", preco: 190000 }
    ],
    "bebidas": [
        { id: "beb-agua", nome: "Água (Com/Sem Gás)", preco: 5000 },
        { id: "beb-spr-250", nome: "Sprite 250ml", preco: 5000 },
        { id: "beb-spr-500", nome: "Sprite 500ml", preco: 10000 },
        { id: "beb-coc-250", nome: "Coca Cola 250ml", preco: 5000 },
        { id: "beb-coc-500", nome: "Coca Cola 500ml", preco: 10000 },
        { id: "beb-coc-1l", nome: "Coca Cola 1 Litro", preco: 15000 }
    ],
    "adicionais": [
        { id: "adc-sho", nome: "Shoyu", preco: 2000 },
        { id: "adc-tar", nome: "Tare (Teriaki)", preco: 3000 },
        { id: "adc-sun", nome: "Sunomono", preco: 2000 },
        { id: "adc-gen", nome: "Gengibre", preco: 2000 },
        { id: "adc-was", nome: "Wasabi", preco: 2000 },
        { id: "adc-cou", nome: "Couve Crispy (5 un)", preco: 5000 }
    ],

    "combos": [
        {
            id: "cmb-1",
            nome: "Combo 1 (Hossomakis)",
            desc: "Salmon, Pepino, Kani e Kani c/ Pepino.",
            opcoes: [
                { tamanho: "20 Unidades", preco: 70000 },
                { tamanho: "40 Unidades", preco: 125000 }
            ],
            img: "https://images.unsplash.com/photo-1579584425555-d3715dfd93fe?w=500&q=80"
        },
        {
            id: "cmb-3",
            nome: "Combo 3 (Completo)",
            desc: "Sashimi, Niguiri, Uramaki, Hot Roll e Hossomaki.",
            opcoes: [
                { tamanho: "25 Unidades", preco: 99000 },
                { tamanho: "50 Unidades", preco: 189000 }
            ],
            img: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=500&q=80"
        }
    ],
    "temakis_crus": [
        { id: "tmk-c-sal", nome: "Salmon y Cream Cheese", preco: 36000, img: "https://images.unsplash.com/photo-1615887023516-9b6bcd559e87?w=500&q=80" },
        { id: "tmk-c-gra", nome: "Salmon Gratinado y Cream Cheese", preco: 36000, img: "https://images.unsplash.com/photo-1615887023516-9b6bcd559e87?w=500&q=80" }
    ],
    "temakis_fritos": [
        { id: "tmk-f-sal", nome: "Salmon y Cream Cheese (Frito)", preco: 41000 },
        { id: "tmk-f-cam", nome: "Camaron y Cream Cheese (Frito)", preco: 41000 }
    ],
    "hot_rolls": [
        { id: "hot-sal", nome: "Hot Roll Salmon", desc: "5 unidades", preco: 27500 },
        { id: "hot-cam", nome: "Hot Roll Camaron", desc: "5 unidades", preco: 27500 }
    ],
    
    // --- ITENS DE UPSELL (Só aparecem no Checkout) ---
    "upsell": [
        { id: "beb-coca-lt", nome: "Coca-Cola 1L", preco: 15000, tipo: "bebida" },
        { id: "beb-coca-500", nome: "Coca-Cola 500ml", preco: 10000, tipo: "bebida" },
        { id: "beb-agua", nome: "Água Mineral", preco: 5000, tipo: "bebida" },
        { id: "adc-tar", nome: "Molho Tarê Extra", preco: 3000, tipo: "adicional" },
        { id: "adc-was", nome: "Wasabi Extra", preco: 2000, tipo: "adicional" },
        { id: "adc-gen", nome: "Gengibre Extra", preco: 2000, tipo: "adicional" }
    ]
};

