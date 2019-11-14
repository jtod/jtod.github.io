# makefile for jtod.github.io/Sigma16 web page

.PHONY : all
all :
	make index

# Generate the top index for the Sigma16 home page
.PHONY : index
index :
	pandoc --standalone \
          --template=default-template.html \
          --variable=css:'./doc.css' \
          -o index.html \
	  index.md

.PHONY : clean
clean :
	find . \( -name '*~' -o -name '*.bak' \) -delete
