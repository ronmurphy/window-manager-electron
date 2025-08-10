import argparse
import re
import cssutils
from pathlib import Path

def extract_html_elements(js_files):
    # Regex patterns to detect HTML-like elements, class attributes, and id attributes within JavaScript strings
    element_pattern = re.compile(r'<([a-zA-Z0-9_-]+)')  # e.g., <div>
    class_pattern = re.compile(r'class=["\']([^"\']+)["\']')  # e.g., class="example"
    id_pattern = re.compile(r'id=["\']([^"\']+)["\']')  # e.g., id="example"
    
    elements = set()
    classes = set()
    ids = set()
    
    for file_path in js_files:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            
            # Find all HTML-like elements embedded within JavaScript
            elements.update(element_pattern.findall(content))
            
            # Find all class and id attributes embedded within JavaScript
            classes.update(class_pattern.findall(content))
            ids.update(id_pattern.findall(content))
    
    return elements, classes, ids

def filter_css(css_file, elements, classes, ids):
    cssutils.log.setLevel('CRITICAL')
    sheet = cssutils.parseFile(css_file)
    
    used_rules = []
    for rule in sheet:
        if rule.type == rule.STYLE_RULE:
            selectors = [sel.selectorText for sel in rule.selectorList]
            is_used = False
            
            for selector in selectors:
                if selector.startswith('.'):
                    if selector[1:] in classes:
                        is_used = True
                elif selector.startswith('#'):
                    if selector[1:] in ids:
                        is_used = True
                elif selector in elements:
                    is_used = True
            
            if is_used:
                used_rules.append(rule.cssText)
    
    return used_rules

def save_filtered_css(used_rules, output_file):
    with open(output_file, 'w', encoding='utf-8') as file:
        for rule in used_rules:
            file.write(rule + '\n')

def main(js_files, css_file, output_file):
    elements, classes, ids = extract_html_elements(js_files)
    used_rules = filter_css(css_file, elements, classes, ids)
    save_filtered_css(used_rules, output_file)
    print(f"Filtered CSS saved to {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Filter unused CSS selectors based on HTML elements in JavaScript files.")
    parser.add_argument('js_files', nargs='+', help="Paths to JavaScript files containing HTML")
    parser.add_argument('css_file', help="Path to the CSS file")
    parser.add_argument('output_file', help="Path to save the filtered CSS file")
    
    args = parser.parse_args()
    main(args.js_files, args.css_file, args.output_file)
