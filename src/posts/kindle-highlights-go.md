---
title: Automate parsing Kindle highlights using Go
date: 2020-02-14
tags: 
  - post
  - coding
  - go
layout: layouts/post.njk
---

I really don't want to use Amazon's Whispersync due to privacy concerns - but I also can't be bothered to manually sync and sort my Kindle highlights. I decided to write a little program in Go that can be easily executed when my Kindle is connected to my laptop.

Normally, my go-to language of choice for such scripts is *Python* - but I'm currently in the process of learning *Go* and try to use it whenever possible. Also *Go* provides us with a nice binary program we can compile for any common platflorm and easily automate it to run whenever we connect a Kindle - without having to manage Python environments.


```go
package main

func main() {
    file, err := os.Open("/Volumes/Kindle/documents/My Clippings.txt")
    if err != nil {
		log.Fatal(err)
	}
}
```

Then we create a file scanner and use ScanLines 

```go
func main() {
    file, err := os.Open("/Volumes/Kindle/documents/My Clippings.txt")
    if err != nil {
		log.Fatal(err)
	}

    scanner := bufio.NewScanner(file)
    scanner.Split(bufio.ScanLines)

    for scanner.Scan() {
        line := scanner.Text()
        fmt.Println(line)
    }
    file.Close()
}

```

The program now prints out the text file line by line - neat. 

Next step is to define a data structure for our highlights.

```text
The Color of Magic (Terry David John Pratchett)
- Your Highlight at location 2-3 | Added on Sunday, 14 February 2021 09:24:24

The Colour of Magic is Terry Pratchett’s maiden voyage through the bizarre land of Discworld.
==========
The Color of Magic (Terry David John Pratchett)
- Your Highlight at location 4-5 | Added on Sunday, 14 February 2021 09:32:41

“All wizards get like that… it’s the quicksilver fumes. Rots their brains. Mushrooms, too.”
==========
```

So, naturally we want to save all this. We could also use a `map`, but a simple data `struct` can be handled much more intuitively (with autocompletion!).

```go
type highlightData struct {
	author    string
	book      string
	timestamp string
	location  string
	text      string
}
```

We can see that Kindle highlights separated by `==========`, so we can define a little constant 
```go
const separator string = "=========="
```

And use a simple counter variable to keep track of the line we are in within each individual highlight. When we reach a seperator line, we reset the counter to zero, otherwise we increment.

```go
    // ...
    var counter int
    for scanner.Scan() {
        line := scanner.Text()
        
        if line == separator {
            counter = 0
            continue
        }
        counter++
    }
    file.Close()
```

So, the first line of each highlight (`counter == 0`) contains the book's author and title

```go
    // ...
    var counter int
    for scanner.Scan() {
        line := scanner.Text()

        if counter == 0 {
            // first header line of the highlight
            // containing book and author name
            
        }
        
        if line == separator {
            counter = 0
            continue
        }
        counter++
    }
    file.Close()
```

So we write a little function to parse the content

```go
func parseAuthorTitle(line string) (string, string) {
	splitLines := strings.Split(line, "(")
	bookRaw := splitLines[0]
	authorRaw := splitLines[1]

	book := strings.TrimSpace(bookRaw)
	author := strings.Trim(authorRaw, ")")
	return author, book
}
```

To save the information we create an empty slice to append our highlights to `var highlights []highlight` and instantiate our first empty highlight `var hl highlight = highlight{}`, which we will fill with our first clipping. 

When we hit a separator, we want to append the current highlight object to our slice of highlights and overwrite our `hl` variable with a new empty `highlight` object which we can fill with the next one.

```go/3-4,10,14-15
    // ...
    var counter int

    var highlights []highlightData
    var hl highlightData = highlight{}

    for scanner.Scan() {
        line := scanner.Text()

        if counter == 0 {
            hl.author, hl.book = parseAuthorTitle(line)
        }
        
        if line == separator {
            highlights = append(highlights, hl)
			hl = highlightData{}
            counter = 0
            continue
        }
        counter++
    }
    file.Close()
```

Next up is the second header line in our highlights, containing the highlight location and timestamp. So we create a new function parsing that:

```go
func parseLocDatetime(line string) (string, string) {
	header := strings.Split(line, " | ")
	locRaw := header[0]
	re := regexp.MustCompile(`[\d]+-[\d]+`)
	locRange := re.FindString(locRaw)

	location := locRange

	dateRaw := header[1]
	timestamp := dateRaw[7:]
	return location, timestamp
}
```

and add it to our parsing loop:

```go/11-13
    // ...
    var counter int

    var highlights []highlightData
    var hl highlightData = highlight{}

    for scanner.Scan() {
        line := scanner.Text()

        if counter == 0 {
            hl.author, hl.book = parseAuthorTitle(line)
        } else if counter == 1 {
            hl.location, hl.timestamp = parseLocDatetime(line)
        }
        
        if line == separator {
            highlights = append(highlights, hl)
			hl = highlightData{}
            counter = 0
            continue
        }
        counter++
    }
    file.Close()
```

Next up is the actualy highlight text - which is much simpler to parse, at we just need to append each text line to our `hl.text`. We can do that in the `else` block:

```go/13,20
    // ...
    var counter int

    var highlights []highlightData
    var hl highlightData = highlightData{}

    for scanner.Scan() {
        line := scanner.Text()

        if counter == 0 {
            hl.author, hl.book = parseAuthorTitle(line)
        } else if counter == 1 {
            hl.location, hl.timestamp = parseLocDatetime(line)
        } else {
            if line == separator {
                highlights = append(highlights, hl)
			    hl = highlightData{}
                counter = 0
                continue
            }
            hl.text = hl.text + line
        }
        counter++
    }
    file.Close()
```

Note that for this to work properly, we have to first check if the line is a separator, as we really don't want that in our highlight text. So we move the code checking for that into the `else` block in front of where we append the text.



What's missing is parsing the timestamp from a string into an actualy timestamp so we can format it as we see fit. I'll have a go at that and add functionality to save our clippings to disk sorted into folders and files by author and book titles.


## Saving it all to disk

Check if highlights folder exists, if not create

```go
func saveHighlight(hl highlightData, loc string) {
	if _, err := os.Stat(loc); os.IsNotExist(err) {
		os.Mkdir(loc, os.ModePerm)
	}
}
```

Check if author folder exists, if not create

```go/4-8
func saveHighlight(hl highlightData, loc string) {
	if _, err := os.Stat(loc); os.IsNotExist(err) {
		os.Mkdir(loc, os.ModePerm)
	}

    authorFolder := highlightsFolder + "/" + highlight.author
	if _, err := os.Stat(authorFolder); os.IsNotExist(err) {
		os.Mkdir(authorFolder, os.ModePerm)
	}
}
```

Check if book file exists, if not create with book title and author

```go/10-18
func saveHighlight(hl highlightData, loc string) {
	if _, err := os.Stat(loc); os.IsNotExist(err) {
		os.Mkdir(loc, os.ModePerm)
	}

    authorFolder := highlightsFolder + "/" + highlight.author
	if _, err := os.Stat(authorFolder); os.IsNotExist(err) {
		os.Mkdir(authorFolder, os.ModePerm)
	}

    bookFile := authorFolder + "/" + highlight.book + ".md"
	if _, err := os.Stat(bookFile); os.IsNotExist(err) {
		err := ioutil.WriteFile(
            bookFile, 
            []byte("# "+highlight.book+"\n## "+highlight.author), 
            0755)
		if err != nil {
			log.Fatal(er)
		}
	}
}
```

Now we check if a given highlight already exists in a file, as to append it again everytime we run the program. If so, we return from the function and do nothing.

```go/20-28
func saveHighlight(highlight highlightData, highlightsFolder string) {
	if _, err := os.Stat(highlightsFolder); os.IsNotExist(err) {
		os.Mkdir(highlightsFolder, os.ModePerm)
	}

	authorFolder := highlightsFolder + "/" + highlight.author
	if _, err := os.Stat(authorFolder); os.IsNotExist(err) {
		os.Mkdir(authorFolder, os.ModePerm)
	}

	bookFile := authorFolder + "/" + highlight.book + ".md"
	if _, err := os.Stat(bookFile); os.IsNotExist(err) {
		err := ioutil.WriteFile(
            bookFile, 
            []byte("# "+highlight.book+"\n## "+highlight.author), 
            0755)
		if err != nil {
			log.Fatal(err)
		}
	}

	fileBytes, err := ioutil.ReadFile(bookFile)
	if err != nil {
		log.Fatal(err)
	}
	fileContent := string(fileBytes)
	if strings.Contains(fileContent, highlight.text) {
		return
	}
}
```

If the highlight text doesn't yet exist, we append it to the file, together with it's timestamp and location

```go/30-43
func saveHighlight(highlight highlightData, highlightsFolder string) {
	if _, err := os.Stat(highlightsFolder); os.IsNotExist(err) {
		os.Mkdir(highlightsFolder, os.ModePerm)
	}

	authorFolder := highlightsFolder + "/" + highlight.author
	if _, err := os.Stat(authorFolder); os.IsNotExist(err) {
		os.Mkdir(authorFolder, os.ModePerm)
	}

	bookFile := authorFolder + "/" + highlight.book + ".md"
	if _, err := os.Stat(bookFile); os.IsNotExist(err) {
		err := ioutil.WriteFile(
            bookFile, 
            []byte("# "+highlight.book+"\n## "+highlight.author), 
            0755)
		if err != nil {
			log.Fatal(err)
		}
	}

	fileBytes, err := ioutil.ReadFile(bookFile)
	if err != nil {
		log.Fatal(err)
	}
	fileContent := string(fileBytes)
	if strings.Contains(fileContent, highlight.text) {
		return
	}

    file, err := os.OpenFile(bookFile, os.O_APPEND|os.O_WRONLY, 0644)
    if err != nil {
        log.Fatal(err)
    }

    if _, err = file.WriteString("\n\n### " + highlight.timestamp); err != nil {
        panic(err)
    }
    if _, err = file.WriteString("\n#### " + strings.Title(highlight.location)); err != nil {
        panic(err)
    }
    if _, err = file.WriteString("\n\n" + highlight.text); err != nil {
        panic(err)
    }
}
```

With that done, we will iterate over all highlights in the `main` function and put each into our newly written `saveHighlight` function:

```go
    // ...
    for _, highlight := range highlights {
            saveHighlight(highlight, "~/kindle-highlights")
    }
```


Which will write the contents to `~/kindle-highlights/author/bookTitle.md` as Markdown.

```
# The Color of Magic
## Terry David John Pratchett

### Sunday, 14 February 2021 09:24:24
#### Location 2-3

The Colour of Magic is Terry Pratchett’s maiden voyage through the bizarre land of Discworld.
```