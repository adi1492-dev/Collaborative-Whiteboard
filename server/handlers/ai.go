package handlers

import (
	"context"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	// In a real implementation, we would import the google.golang.org/api/gemini client here
	// For this prototype, we'll mock the response if no API key is present
)

type AIRequest struct {
	Elements []map[string]interface{} `json:"elements"`
}

// SummarizeBoard uses Gemini (mocked) to summarize the board content
func SummarizeBoard(c *gin.Context) {
	// boardID := c.Param("id")
	
	var req AIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	
	if apiKey == "" {
		// Mock response for internship demo purposes
		summary := generateMockSummary(req.Elements)
		c.JSON(http.StatusOK, gin.H{"summary": summary})
		return
	}

	// TODO: Actual Gemini integration here
	// client, err := genai.NewClient(context.Background(), option.WithAPIKey(apiKey))
	// ...

	c.JSON(http.StatusOK, gin.H{"summary": generateMockSummary(req.Elements)})
}

func generateMockSummary(elements []map[string]interface{}) string {
	if len(elements) == 0 {
		return "## Empty Board\n\nThe board is currently empty. Add some sticky notes or text to generate a summary."
	}

	summary := "## AI Board Summary\n\n"
	summary += "Based on the whiteboard contents, here is a synthesized overview:\n\n"
	
	var texts []string
	for _, el := range elements {
		if text, ok := el["text"].(string); ok && text != "" {
			texts = append(texts, text)
		}
	}

	if len(texts) > 0 {
		summary += "### Key Topics Discussed:\n"
		for _, t := range texts {
			// Just a simple mock that truncates long text
			display := t
			if len(display) > 50 {
				display = display[:47] + "..."
			}
			summary += "- " + display + "\n"
		}
		
		summary += "\n### Recommended Next Steps:\n"
		summary += "1. Review the architecture components highlighted in the diagram.\n"
		summary += "2. Assign owners to the newly created sticky notes.\n"
		summary += "3. Schedule a follow-up sync to resolve any open questions.\n"
	} else {
		summary += "The board contains shapes or drawings but no readable text to summarize."
	}

	return summary
}
