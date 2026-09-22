import os

# Paste your folder structure text content here or let's use the layout you provided
structure = """
sunscape-metrics/
│
├── backend/
│   │
│   ├── app.py
│   ├── config.py
│   ├── requirements.txt
│   ├── .env.example
│   │
│   ├── data/
│   │   ├── open_meteo.py
│   │   └── osm.py
│   │
│   ├── logic/
│   │   ├── heat_rules.py
│   │   └── heat_alert.py
│   │
│   ├── ai/
│   │   └── explain.py
│   │
│   └── store/
│       └── memory_store.py
│
├── frontend/
│   │
│   ├── index.html
│   ├── heatwatch.html
│   ├── heatalert.html
│   ├── heatmap.html
│   │
│   ├── css/
│   │   └── styles.css
│   │
│   ├── js/
│   │   ├── main.js
│   │   ├── heatwatch.js
│   │   ├── heatalert.js
│   │   └── heatmap.js
│   │
│   └── assets/
│       ├── images/
│       └── icons/
│
├── docs/
│   ├── Sunscape_Metrics_Report.docx
│   ├── use-case-diagram.png
│   └── screenshots/
│
├── ppt/
│   └── Sunscape_Metrics_Presentation.pptx
│
├── README.md
└── .gitignore
"""
 
current_dir = ""

for line in structure.strip().splitlines():
    # Clean up tree symbols to isolate path segments
    clean_line = line.replace("└──", "").replace("├──", "").replace("│", "").strip()
    if not clean_line:
        continue
    
    # Track nesting level by counting leading vertical lines or spacing
    indent_level = len(line) - len(line.lstrip("│ "))
    
    # If it has a file extension or is a known file/dir name without extension
    if "." in clean_line or clean_line in ["images", "icons", "screenshots"]:
        # It's a file or a leaf directory
        path = os.path.join(current_dir, clean_line)
        if "." in clean_line:
            # Create parent directories if they don't exist and touch the file
            os.makedirs(os.path.dirname(path), exist_ok=True)
            open(path, "a").close()
        else:
            os.makedirs(path, exist_ok=True)
    else:
        # It's a directory
        current_dir = clean_line # Adjust path management based on depth if needed