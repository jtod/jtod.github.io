# makefile for Sigma16 web page

.PHONY : all
all :
	make index

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
