---
title: Automate parsing Kindle highlights using Go
date: 2021-02-14
tags:
  - post
  - coding
  - go
layout: layouts/post.njk
---

Syncing highlights from my Kindle without relying on Amazon's [Whispersync](https://www.theverge.com/2020/1/31/21117217/amazon-kindle-tracking-page-turn-taps-e-reader-privacy-policy-security-whispersync) involves copying your clippings file from the Kindle, either using tools such as [Calibre](https://calibre-ebook.com/), or manually. And the Kindle just dumps all highlights into one file - which is great if you just want to search over all your highlights. But I find myself often just wanting to conveniently look at my highlights from single book.

So as an exercise in further learning Go I decided to write a little program that can be easily executed whenever I connect my kindle. An advantage of using a compiled language like Go is that provides us with a nice binary program we can compile for any common platflorm and easily automate it to run whenever we connect a Kindle - without having to manage Python environments.

So let's start out with our `main` function and load open the clippings text file from the connected Kindle device. You may have to modify the path depending on your device and operating system.

```go
package main

func main() {
    file, err := os.Open("/Volumes/Kindle/documents/My Clippings.txt")
    if err != nil {
		log.Fatal(err)
	}
    file.Close()
}
```

We can now use a [Scanner](https://medium.com/golangspec/in-depth-introduction-to-bufio-scanner-in-golang-55483bb689b4) from Go's `bufio` package, and use it's `Split` read the file line by line. We can iterate to the next line by calling `scanner.Scan()` and access the line's text using `scanner.Text()`.

```go/6-12
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

So now that we have access to every line in the file, we can have a look at the structure of the text file to figure out how to parse it. Here are two highlights:

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

The individual highlights are separated by `==========`. Each first line of a highlight contains the book title and author. In the second line we find the highlight's location and when it was created. The actual highlight comes afterwards.

So, naturally we want to save all this info. We could use a `map` as a data structure for the highlights, but a simple data `struct` can handles much more intuitively and with autocompletion:

```go
type HighlightData struct {
	Author    string
	Book      string
	Timestamp string
	Location  string
	Text      string
}
```

We also define a constant for the separator:

```go
const separator string = "=========="
```

Now, for the parsing we always want to know the current line, but not of the humongous `My Clippings.txt` file itself, but within each highlight. That way we can easily determine where the metadata is located. We can use a simple counter variable to keep track of the line we are in within each individual highlight. When we reach a seperator line, we reset the counter to zero, otherwise we increment:

```go/5-9
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

## Parsing author and book title

Alright, next up is parsing the first line of each highlight: book title and author. The function `parseAuthorTitle` takes in the target line as a string, splits it at the opening parenthesis into book title and author. We then just need to trim the spaces and trailing parenthesis off, and return the two strings.

```go
// example line:
// The Color of Magic (Terry David John Pratchett)
func parseAuthorTitle(line string) (string, string) {
	splitLines := strings.Split(line, "(")
	bookRaw := splitLines[0]
	authorRaw := splitLines[1]

	book := strings.TrimSpace(bookRaw)
	author := strings.Trim(authorRaw, ")")
	return author, book
}
```

Okay, now that we have our first part of parsed data and our data structure defined, we need a convenient way of saving it. For that we create an empty slice to append our highlights to (`var highlights []HighlightData`) and instantiate our first empty highlight `var highlight HighlightData = HighlightData{}`, which we will fill with our first clipping. Once we've parsed all lines of the first highlight, we'll hit a separator. We then append the current highlight object to our slice of highlights and overwrite our `highlight` variable with a new empty `HighlightData` object which we can fill with the next highlight.

```go/3-4,9-11,14-15
    // ...
    var counter int

    var highlights []HighlightData
    var hl HighlightData = highlight{}

    for scanner.Scan() {
        line := scanner.Text()

        if counter == 0 {
            hl.author, hl.book = parseAuthorTitle(line)
        }

        if line == separator {
            highlights = append(highlights, hl)
			hl = HighlightData{}
            counter = 0
            continue
        }
        counter++
    }
    file.Close()
```

## Parsing location and timestamp

Next up is the second line in each highlight, containing its book location and timestamp. So we create a new function called `parseLocDatetime`, which also takes the line as an input and outputs the location and timestamp as strings. We split the line at the pipe `|` into the location on the left and timestamp on the right.

We then use a regular expression to extract just the location numbers. `[\d]+-[\d]+` will do just fine for that. For the timestamp, we can just remove the `Added on ` and be done with it. If you want to actually parse the timestamp string into a timestamp-like object, this would be the place to do it. But I'm fine with the timestamp as it is.

```go
// example line
// - Your Highlight at location 2-3 | Added on Sunday, 14 February 2021 09:24:24
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

Adding the function call to our parsing loop, only triggering it in the second line of each clipping:

```go/11-13
    // ...
    var counter int

    var highlights []HighlightData
    var hl HighlightData = highlight{}

    for scanner.Scan() {
        line := scanner.Text()

        if counter == 0 {
            hl.author, hl.book = parseAuthorTitle(line)
        } else if counter == 1 {
            hl.location, hl.timestamp = parseLocDatetime(line)
        }

        if line == separator {
            highlights = append(highlights, hl)
			hl = HighlightData{}
            counter = 0
            continue
        }
        counter++
    }
    file.Close()
```

Next up is the actually highlighted text - which is much simpler to parse, as we just need to append each text line to our `highlight.Text` property. We can do that in the `else` block:

```go/13,20
    // ...
    var counter int

    var highlights []HighlightData
    var hl HighlightData = HighlightData{}

    for scanner.Scan() {
        line := scanner.Text()

        if counter == 0 {
            hl.author, hl.book = parseAuthorTitle(line)
        } else if counter == 1 {
            hl.location, hl.timestamp = parseLocDatetime(line)
        } else {
            if line == separator {
                highlights = append(highlights, hl)
			    hl = HighlightData{}
                counter = 0
                continue
            }
            hl.text = hl.text + line
        }
        counter++
    }
    file.Close()
```

Note that for this to work properly, we have to first check if the line is a separator, as we really don't want that in our highlight text. So we move the code checking for the separator into the `else` block in front of where we append the text.

And with that we're all done with the actual parsing code. But what's missing is saving it to disk in convenient file structure.

## Saving it all to disk

I want my clippings to be stored on my NAS server in a `kindle-clippings` folder, with a folder for each author and a markdown file for each book. For that let's code up a `saveHighlight` function that takes as arguments the highlight to save, and the clippings root folder.

As a first step, we check if the folder exists - and create it if not:

```go
func saveHighlight(hl HighlightData, loc string) {
	if _, err := os.Stat(loc); os.IsNotExist(err) {
		os.Mkdir(loc, os.ModePerm)
	}
}
```

Then we do the same thing with the author folder:

```go/4-8
func saveHighlight(hl HighlightData, loc string) {
	if _, err := os.Stat(loc); os.IsNotExist(err) {
		os.Mkdir(loc, os.ModePerm)
	}

    authorFolder := highlightsFolder + "/" + highlight.Author
	if _, err := os.Stat(authorFolder); os.IsNotExist(err) {
		os.Mkdir(authorFolder, os.ModePerm)
	}
}
```

And then check if the book file exists. If not we create it with both the book title and author at the top:

```go/10-18
func saveHighlight(hl HighlightData, loc string) {
	if _, err := os.Stat(loc); os.IsNotExist(err) {
		os.Mkdir(loc, os.ModePerm)
	}

    authorFolder := highlightsFolder + "/" + highlight.Author
	if _, err := os.Stat(authorFolder); os.IsNotExist(err) {
		os.Mkdir(authorFolder, os.ModePerm)
	}

    bookFile := authorFolder + "/" + highlight.Book + ".md"
	if _, err := os.Stat(bookFile); os.IsNotExist(err) {
		err := ioutil.WriteFile(
            bookFile,
            []byte("# "+highlight.Book+"\n## "+highlight.Author),
            0755) // unix file permissions code
		if err != nil {
			log.Fatal(er)
		}
	}
}
```

What we really don't want to do next is to just overwrite our highlights files everytime we run the program. Rather, let's check if the file already contains our highlight text. If so, we return, if not we can then go ahead and append the highlight. We do this by reading in the entire file, turn it into a big string and use `strings.Contains` to do the check.

```go/20-28
func saveHighlight(highlight HighlightData, highlightsFolder string) {
	if _, err := os.Stat(highlightsFolder); os.IsNotExist(err) {
		os.Mkdir(highlightsFolder, os.ModePerm)
	}

	authorFolder := highlightsFolder + "/" + highlight.Author
	if _, err := os.Stat(authorFolder); os.IsNotExist(err) {
		os.Mkdir(authorFolder, os.ModePerm)
	}

	bookFile := authorFolder + "/" + highlight.Book + ".md"
	if _, err := os.Stat(bookFile); os.IsNotExist(err) {
		err := ioutil.WriteFile(
            bookFile,
            []byte("# "+highlight.Book+"\n## "+highlight.Author),
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
	if strings.Contains(fileContent, highlight.Text) {
		return
	}
}
```

After that we can go ahead with appending the highlight metadata and text:

```go/30-43
func saveHighlight(highlight HighlightData, highlightsFolder string) {
	if _, err := os.Stat(highlightsFolder); os.IsNotExist(err) {
		os.Mkdir(highlightsFolder, os.ModePerm)
	}

	authorFolder := highlightsFolder + "/" + highlight.Author
	if _, err := os.Stat(authorFolder); os.IsNotExist(err) {
		os.Mkdir(authorFolder, os.ModePerm)
	}

	bookFile := authorFolder + "/" + highlight.Book + ".md"
	if _, err := os.Stat(bookFile); os.IsNotExist(err) {
		err := ioutil.WriteFile(
            bookFile,
            []byte("# "+highlight.Book+"\n## "+highlight.Author),
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
	if strings.Contains(fileContent, highlight.Text) {
		return
	}

    file, err := os.OpenFile(bookFile, os.O_APPEND|os.O_WRONLY, 0644)
    if err != nil {
        log.Fatal(err)
    }

    if _, err = file.WriteString("\n\n### " + highlight.Timestamp); err != nil {
        panic(err)
    }
    if _, err = file.WriteString("\n#### " + strings.Title(highlight.Location)); err != nil {
        panic(err)
    }
    if _, err = file.WriteString("\n\n" + highlight.Text); err != nil {
        panic(err)
    }
}
```

With that done, we iterate over all highlights in the `main` function and pass every highlight into our newly written `saveHighlight` function, which will write all the contents to the given folder path:

```go
    // ...
    for _, highlight := range highlights {
            saveHighlight(highlight, "~/kindle-highlights")
    }
```

An example file with one highlight looks like the following:

```
# The Color of Magic
## Terry David John Pratchett

### Sunday, 14 February 2021 09:24:24
#### Location 2-3

The Colour of Magic is Terry Pratchett’s maiden voyage through the bizarre land of Discworld.
```

The only thing missing is to allow passing a destination folder parameter to the main function so that we can conveniently use it as a command line tool without having to always edit the filepath in the source code. We can easily access the raw command-line arguments using `os.Args`, which is of type `slice`. Its first value is the program path. So if we want to call our program using `go run main.go "~/kindle-highlights"` (or `programName "~/kindle-highlights"` when compiled), we can access the path with `os.Args[1]`:

```go/2
    // ...
    for _, highlight := range highlights {
		saveHighlight(highlight, os.Args[1])
	}

```

Awesome! That's it. Compile it and run it whenever you want to sync your highlights. Or write some code to automate running the script whenever a USB device mounts!

## All the code

```go
package main

import (
	"bufio"
	"io/ioutil"
	"log"
	"os"
	"regexp"
	"strings"
)

const separator string = "=========="

type HighlightData struct {
	author    string
	book      string
	timestamp string
	location  string
	text      string
}

func parseAuthorTitle(line string) (string, string) {
	splitLines := strings.Split(line, "(")
	bookRaw := splitLines[0]
	authorRaw := splitLines[1]

	book := strings.TrimSpace(bookRaw)[3:]
	author := strings.Trim(authorRaw, ")")
	return author, book
}

func parseLocDatetime(line string) (string, string) {
	header := strings.Split(line, " | ")
	locRaw := header[0]
	re := regexp.MustCompile(`location [\d]+-[\d]+`)
	location := re.FindString(locRaw)

	dateRaw := header[1]
	timestamp := dateRaw[9:]
	return location, timestamp
}

func saveHighlight(highlight HighlightData, highlightsFolder string) {
	if _, err := os.Stat(highlightsFolder); os.IsNotExist(err) {
		os.Mkdir(highlightsFolder, os.ModePerm)
	}

	authorFolder := highlightsFolder + "/" + highlight.Author
	if _, err := os.Stat(authorFolder); os.IsNotExist(err) {
		os.Mkdir(authorFolder, os.ModePerm)
	}

	bookFile := authorFolder + "/" + highlight.Book + ".md"
	if _, err := os.Stat(bookFile); os.IsNotExist(err) {
		err := ioutil.WriteFile(
			bookFile,
			[]byte("# "+highlight.Book+"\n## "+highlight.Author),
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
	if strings.Contains(fileContent, highlight.Text) {
		return
	}

	file, err := os.OpenFile(bookFile, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatal(err)
	}

	if _, err = file.WriteString("\n\n### " + highlight.Timestamp); err != nil {
		panic(err)
	}
	if _, err = file.WriteString("\n#### " + strings.Title(highlight.Location)); err != nil {
		panic(err)
	}
	if _, err = file.WriteString("\n\n" + highlight.Text); err != nil {
		panic(err)
	}

	file.Close()
}

func main() {
	file, err := os.Open("/Volumes/Kindle/documents/My Clippings.txt")
	if err != nil {
		log.Fatal(err)
	}

	scanner := bufio.NewScanner(file)

	scanner.Split(bufio.ScanLines)

	var counter int

	var highlights []HighlightData
	var hl HighlightData = HighlightData{}
	for scanner.Scan() {
		line := scanner.Text()
		if counter == 0 {
			hl.author, hl.book = parseAuthorTitle(line)
		} else if counter == 1 {
			hl.location, hl.timestamp = parseLocDatetime(line)
		} else {
			if line == separator {
				highlights = append(highlights, hl)
				hl = HighlightData{}
				counter = 0
				continue
			}
			hl.text = hl.text + line
		}
		counter++
	}

	file.Close()

	for _, highlight := range highlights {
		saveHighlight(highlight, os.Args[1])
	}
}
```
